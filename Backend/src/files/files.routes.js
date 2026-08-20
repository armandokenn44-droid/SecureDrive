import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import { requireAuth } from "../middleware/auth.middleware.js";
import { pool } from "../db/pool.js";
import { logActivity } from "../activity/activity.routes.js";
import {
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BUCKET_NAME } from "../config/s3Client.js";
import { getTemporaryS3Client } from "../config/stsClient.js";

const router = Router();

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "text/plain",
  "text/css",
  "text/javascript",
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function canAccessKey(fileKey, user) {
  const isOwner =
    fileKey.startsWith(`uploads/${user.userId}/`) ||
    fileKey.startsWith(`trash/${user.userId}/`);
  const isSuperAdmin = user.role === "Super Admin";
  return isOwner || isSuperAdmin;
}

async function getSharePermission(fileKey, userId) {
  const result = await pool.query(
    `SELECT permission FROM shares
     WHERE file_key = $1 AND shared_with_id = $2`,
    [fileKey, userId]
  );
  return result.rows[0]?.permission || null;
}

// GET /api/files?path=
router.get("/", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const userId = req.user.userId;
    const isSuperAdmin = req.user.role === "Super Admin";

    let prefix = req.query.path || (isSuperAdmin ? "uploads/" : `uploads/${userId}/`);
    if (!isSuperAdmin && !prefix.startsWith(`uploads/${userId}/`)) {
      return res.status(403).json({ error: "Access denied to this path" });
    }
    if (!prefix.endsWith("/")) prefix += "/";

    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        Delimiter: "/",
        MaxKeys: 200,
      })
    );

    const folders = (response.CommonPrefixes || []).map((p) => {
      const full = p.Prefix;
      const parts = full.replace(/\/$/, "").split("/");
      return { key: full, name: parts[parts.length - 1], type: "folder" };
    });

    const files = (response.Contents || [])
      .filter((item) => {
        if (!item.Key || item.Key.endsWith("/")) return false;
        if (item.Key.endsWith(".keep")) return false;
        const relative = item.Key.slice(prefix.length);
        return relative && !relative.includes("/");
      })
      .map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        type: "file",
      }));

    res.json({
      bucket: BUCKET_NAME,
      path: prefix,
      folders,
      files,
      count: folders.length + files.length,
    });
  } catch (err) {
    console.error("List files error:", err.message);
    res.status(500).json({ error: "Could not list files from S3", details: err.message });
  }
});

// POST /api/files/folder
router.post("/folder", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const rawName = (req.body.name || "").trim();
    if (!rawName) return res.status(400).json({ error: "Folder name is required" });

    const safe = sanitizeFileName(rawName);
    if (!safe) return res.status(400).json({ error: "Invalid folder name" });

    const userId = req.user.userId;
    let parent = req.body.parent || `uploads/${userId}/`;
    if (!parent.startsWith(`uploads/${userId}/`) && req.user.role !== "Super Admin") {
      return res.status(403).json({ error: "Invalid parent path" });
    }
    if (!parent.endsWith("/")) parent += "/";

    const folderKey = `${parent}${safe}/`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${folderKey}.keep`,
        Body: Buffer.from(""),
        ContentType: "application/x-directory",
        ServerSideEncryption: "AES256",
      })
    );

    await logActivity({
      userId: req.user.userId,
      userName: req.user.email || `User #${req.user.userId}`,
      action: "Created folder",
      detail: safe,
    });

    res.status(201).json({ message: "Folder created", folderKey, name: safe });
  } catch (err) {
    console.error("Create folder error:", err.message);
    res.status(500).json({ error: "Could not create folder", details: err.message });
  }
});

// POST /api/files/move
router.post("/move", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const { key, destinationPath } = req.body;

    if (!key || !destinationPath) {
      return res.status(400).json({ error: "Missing key or destinationPath" });
    }
    if (!canAccessKey(key, req.user)) {
      return res.status(403).json({ error: "You don't have permission to move this file." });
    }
    if (!key.startsWith("uploads/")) {
      return res.status(400).json({ error: "Only files in uploads/ can be moved." });
    }

    let dest = destinationPath;
    if (!dest.endsWith("/")) dest += "/";

    const userId = req.user.userId;
    if (req.user.role !== "Super Admin" && !dest.startsWith(`uploads/${userId}/`)) {
      return res.status(403).json({ error: "Invalid destination" });
    }

    const fileName = key.split("/").pop();
    const newKey = `${dest}${fileName}`;
    if (newKey === key) {
      return res.status(400).json({ error: "File is already in this folder" });
    }

    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${key}`,
        Key: newKey,
      })
    );
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));

    await logActivity({
      userId: req.user.userId,
      userName: req.user.email || `User #${req.user.userId}`,
      action: "Moved a file",
      detail: `${key} → ${newKey}`,
    });

    res.json({ message: "File moved", from: key, to: newKey });
  } catch (err) {
    console.error("Move error:", err.message);
    res.status(500).json({ error: "Could not move file", details: err.message });
  }
});

// POST /api/files/upload
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    if (!req.file) return res.status(400).json({ error: "No file received" });

    const { originalname, mimetype, buffer, size } = req.file;
    if (!ALLOWED_TYPES.has(mimetype)) {
      return res.status(415).json({ error: `File type "${mimetype}" is not allowed.` });
    }

    let basePath = (req.body.path || `uploads/${req.user.userId}/`).trim();
    if (!basePath.endsWith("/")) basePath += "/";
    if (
      req.user.role !== "Super Admin" &&
      !basePath.startsWith(`uploads/${req.user.userId}/`)
    ) {
      return res.status(403).json({ error: "Invalid upload path" });
    }

    const uniqueId = crypto.randomUUID();
    const safeName = sanitizeFileName(originalname);
    const fileKey = `${basePath}${uniqueId}-${safeName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: buffer,
        ContentType: mimetype,
        ServerSideEncryption: "AES256",
      })
    );

    await logActivity({
      userId: req.user.userId,
      userName: req.user.email || `User #${req.user.userId}`,
      action: "Uploaded a file",
      detail: originalname,
    });

    res.status(201).json({
      message: "File uploaded successfully",
      fileKey,
      fileName: originalname,
      size,
      type: mimetype,
    });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Could not upload file to S3", details: err.message });
  }
});

// GET /api/files/preview
router.get("/preview", requireAuth, async (req, res) => {
  try {
    const fileKey = req.query.key;
    if (!fileKey) return res.status(400).json({ error: "Missing key" });

    const userId = req.user.userId;
    const isOwner =
      fileKey.startsWith(`uploads/${userId}/`) ||
      fileKey.startsWith(`trash/${userId}/`);
    const isSuperAdmin = req.user.role === "Super Admin";

    let isSharedWithMe = false;
    if (!isOwner && !isSuperAdmin) {
      const shareCheck = await pool.query(
        `SELECT id FROM shares WHERE file_key = $1 AND shared_with_id = $2`,
        [fileKey, userId]
      );
      isSharedWithMe = shareCheck.rows.length > 0;
    }
    if (!isOwner && !isSuperAdmin && !isSharedWithMe) {
      return res.status(403).json({ error: "You don't have permission to preview this file." });
    }

    const rawName = fileKey.split("/").pop() || "file";
    const displayName = rawName.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      ""
    );
    const ext = (displayName.split(".").pop() || "").toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext);
    const isPdf = ext === "pdf";
    if (!isImage && !isPdf) {
      return res.status(415).json({
        error: "Preview not available for this file type.",
        fileName: displayName,
        previewable: false,
      });
    }

    const s3 = await getTemporaryS3Client(`user-${userId}`);
    const previewUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey }),
      { expiresIn: 600 }
    );

    res.json({
      previewUrl,
      fileName: displayName,
      type: isPdf ? "pdf" : "image",
      previewable: true,
    });
  } catch (err) {
    console.error("Preview error:", err.message);
    res.status(500).json({ error: "Could not create preview URL", details: err.message });
  }
});

// GET /api/files/download
router.get("/download", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const fileKey = req.query.key;
    if (!fileKey) return res.status(400).json({ error: "Missing 'key' query parameter." });

    const userId = req.user.userId;
    const isOwner =
      fileKey.startsWith(`uploads/${userId}/`) ||
      fileKey.startsWith(`trash/${userId}/`);
    const isSuperAdmin = req.user.role === "Super Admin";

    let isSharedWithMe = false;
    if (!isOwner && !isSuperAdmin) {
      const shareCheck = await pool.query(
        `SELECT id FROM shares WHERE file_key = $1 AND shared_with_id = $2`,
        [fileKey, userId]
      );
      isSharedWithMe = shareCheck.rows.length > 0;
    }
    if (!isOwner && !isSuperAdmin && !isSharedWithMe) {
      return res.status(403).json({ error: "You don't have permission to download this file." });
    }

    const s3Response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey })
    );
    const rawName = fileKey.split("/").pop();
    const displayName = rawName.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      ""
    );

    res.setHeader("Content-Type", s3Response.ContentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${displayName}"`);
    s3Response.Body.pipe(res);
  } catch (err) {
    console.error("Download error:", err.message);
    res.status(500).json({ error: "Could not download file.", details: err.message });
  }
});

// POST /api/files/replace
router.post("/replace", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const fileKey = req.body.key;
    if (!fileKey) return res.status(400).json({ error: "Missing key" });
    if (!req.file) return res.status(400).json({ error: "No file received" });

    const userId = req.user.userId;
    const isOwner = fileKey.startsWith(`uploads/${userId}/`);
    const isSuperAdmin = req.user.role === "Super Admin";

    if (!isOwner && !isSuperAdmin) {
      const permission = await getSharePermission(fileKey, userId);
      if (!permission) {
        return res.status(403).json({ error: "You don't have permission to modify this file." });
      }
      if (permission === "Read Only") {
        return res.status(403).json({
          error: "This file is shared as Read Only. You cannot modify it.",
        });
      }
    }

    const { mimetype, buffer } = req.file;
    if (!ALLOWED_TYPES.has(mimetype)) {
      return res.status(415).json({ error: `File type "${mimetype}" is not allowed.` });
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: buffer,
        ContentType: mimetype,
        ServerSideEncryption: "AES256",
      })
    );

    await logActivity({
      userId: req.user.userId,
      userName: req.user.email || `User #${req.user.userId}`,
      action: "Updated/replaced a file",
      detail: fileKey,
    });

    res.json({ message: "File replaced successfully", fileKey });
  } catch (err) {
    console.error("Replace error:", err.message);
    res.status(500).json({ error: "Could not replace file.", details: err.message });
  }
});

// POST /api/files/trash
router.post("/trash", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: "Missing key" });
    if (!canAccessKey(key, req.user)) {
      return res.status(403).json({ error: "You don't have permission to trash this file." });
    }
    if (!key.startsWith("uploads/")) {
      return res.status(400).json({ error: "Only files in uploads/ can be moved to trash." });
    }

    const trashKey = key.replace(/^uploads\//, "trash/");
    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${key}`,
        Key: trashKey,
      })
    );
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));

    await logActivity({
      userId: req.user.userId,
      userName: req.user.email || `User #${req.user.userId}`,
      action: "Moved file to trash",
      detail: key,
    });

    res.json({ message: "File moved to trash", trashKey });
  } catch (err) {
    console.error("Trash error:", err.message);
    res.status(500).json({ error: "Could not move file to trash.", details: err.message });
  }
});

// GET /api/files/trash
router.get("/trash", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const isSuperAdmin = req.user.role === "Super Admin";
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        MaxKeys: 100,
        Prefix: isSuperAdmin ? "trash/" : `trash/${req.user.userId}/`,
      })
    );
    const files = (response.Contents || [])
      .filter((item) => item.Key && !item.Key.endsWith("/"))
      .map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
      }));
    res.json({ count: files.length, files });
  } catch (err) {
    console.error("List trash error:", err.message);
    res.status(500).json({ error: "Could not list trash.", details: err.message });
  }
});

// POST /api/files/restore
router.post("/restore", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: "Missing key" });
    if (!canAccessKey(key, req.user)) {
      return res.status(403).json({ error: "You don't have permission to restore this file." });
    }
    if (!key.startsWith("trash/")) {
      return res.status(400).json({ error: "Only files in trash/ can be restored." });
    }

    const restoreKey = key.replace(/^trash\//, "uploads/");
    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${key}`,
        Key: restoreKey,
      })
    );
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));

    await logActivity({
      userId: req.user.userId,
      userName: req.user.email || `User #${req.user.userId}`,
      action: "Restored file from trash",
      detail: key,
    });

    res.json({ message: "File restored", restoreKey });
  } catch (err) {
    console.error("Restore error:", err.message);
    res.status(500).json({ error: "Could not restore file.", details: err.message });
  }
});

// DELETE /api/files
router.delete("/", requireAuth, async (req, res) => {
  try {
    const s3 = await getTemporaryS3Client(`user-${req.user.userId}`);
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: "Missing key" });
    if (!canAccessKey(key, req.user)) {
      return res.status(403).json({ error: "You don't have permission to delete this file." });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));

    await logActivity({
      userId: req.user.userId,
      userName: req.user.email || `User #${req.user.userId}`,
      action: "Permanently deleted file",
      detail: key,
    });

    res.json({ message: "File permanently deleted" });
  } catch (err) {
    console.error("Delete forever error:", err.message);
    res.status(500).json({ error: "Could not delete file.", details: err.message });
  }
});

export default router;