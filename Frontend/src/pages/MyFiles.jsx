import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import FilePreviewModal from "../components/FilePreviewModal.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function formatSize(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function cleanName(key) {
  const raw = (key || "").split("/").filter(Boolean).pop() || key || "file";
  return raw.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    ""
  );
}

function guessType(name) {
  const ext = (name || "").split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "image";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx"].includes(ext)) return "sheet";
  if (["ppt", "pptx"].includes(ext)) return "slides";
  if (ext === "pdf") return "pdf";
  return "file";
}

function canPreview(name) {
  const ext = (name || "").split(".").pop().toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "svg", "webp", "pdf"].includes(ext);
}

function getUserRootPath(user) {
  const id = user?.userId || user?.id;
  if (id) return `uploads/${id}/`;
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    const uid = u?.userId || u?.id;
    if (uid) return `uploads/${uid}/`;
  } catch {
    /* ignore */
  }
  return "uploads/";
}

export default function MyFiles() {
  const outlet = useOutletContext() || {};
  const user = outlet.user;
  const setFilesGlobal = outlet.setFiles;

  const [path, setPath] = useState(() => getUserRootPath(user));
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [favoriteKeys, setFavoriteKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState(null);

  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const [menuOpen, setMenuOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [shareModal, setShareModal] = useState(null); // file
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("Read Only");
  const [sharing, setSharing] = useState(false);
  const [toasts, setToasts] = useState([]);

  const uploadInputRef = useRef(null);
  const menuRef = useRef(null);

  function showToast(message, type = "ok") {
    // eslint-disable-next-line react-hooks/purity
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5000);
  }

  async function loadFavorites() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const keys = new Set(
        (data.favorites || []).map((f) => f.file_key || f.key)
      );
      setFavoriteKeys(keys);
    } catch {
      /* ignore */
    }
  }

  async function load(currentPath = path) {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/api/files?path=${encodeURIComponent(currentPath)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load files");
        return;
      }
      const folderList = data.folders || [];
      const fileList = (data.files || []).map((f) => {
        const name = cleanName(f.key);
        return {
          key: f.key,
          name,
          size: f.size,
          lastModified: f.lastModified,
          type: guessType(name),
        };
      });
      setFolders(folderList);
      setFiles(fileList);
      if (typeof setFilesGlobal === "function") setFilesGlobal(fileList);
      if (data.path) setPath(data.path);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const root = getUserRootPath(user);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPath(root);
    load(root);
    loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId || user?.id]);

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function openFolder(folderKey) {
    setMenuOpen(null);
    setPath(folderKey);
    load(folderKey);
  }

  function goUp() {
    const root = getUserRootPath(user);
    if (path === root || path.length <= root.length) return;
    const trimmed = path.replace(/\/$/, "");
    const parts = trimmed.split("/");
    parts.pop();
    let parent = parts.join("/") + "/";
    if (!parent.startsWith(root)) parent = root;
    setPath(parent);
    load(parent);
  }

  function breadcrumbParts() {
    const root = getUserRootPath(user);
    const relative = path.startsWith(root) ? path.slice(root.length) : path;
    return relative.split("/").filter(Boolean);
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!folderName.trim()) return;
    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/files/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: folderName.trim(), parent: path }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Could not create folder", "error");
        return;
      }
      setFolderName("");
      setFolderModal(false);
      showToast(`Folder "${data.name || folderName}" created`);
      load(path);
    } catch {
      showToast("Cannot connect to server", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleUploadHere(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem("token");
    const form = new FormData();
    form.append("file", file);
    form.append("path", path);
    try {
      const res = await fetch(`${API_BASE}/api/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Upload failed", "error");
        return;
      }
      showToast(`"${file.name}" uploaded`);
      load(path);
    } catch {
      showToast("Cannot connect to server", "error");
    } finally {
      e.target.value = "";
    }
  }

  function requestDownload(file) {
    setMenuOpen(null);
    setConfirm({
      title: "Download file?",
      message: `Download "${file.name}" to your computer?`,
      confirmLabel: "Download",
      danger: false,
      onConfirm: () => doDownload(file),
    });
  }

  async function doDownload(file) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_BASE}/api/files/download?key=${encodeURIComponent(file.key)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Download failed", "error");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Downloading "${file.name}"`);
    } catch {
      showToast("Cannot connect to server", "error");
    }
  }

  function requestTrash(file) {
    setMenuOpen(null);
    setConfirm({
      title: "Move to trash?",
      message: `"${file.name}" will be moved to Trash. You can restore it later.`,
      confirmLabel: "Move to trash",
      danger: true,
      onConfirm: () => doTrash(file),
    });
  }

  async function doTrash(file) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/files/trash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: file.key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Could not move to trash", "error");
        return;
      }
      showToast(`"${file.name}" moved to trash`);
      load(path);
    } catch {
      showToast("Cannot connect to server", "error");
    }
  }

  async function toggleFavorite(file) {
    setMenuOpen(null);
    const token = localStorage.getItem("token");
    const isFav = favoriteKeys.has(file.key);
    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: isFav ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isFav
            ? { fileKey: file.key }
            : { fileKey: file.key, fileName: file.name }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Favorite failed", "error");
        return;
      }
      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(file.key);
        else next.add(file.key);
        return next;
      });
      showToast(
        isFav
          ? `"${file.name}" removed from favorites`
          : `"${file.name}" added to favorites`
      );
    } catch {
      showToast("Cannot connect to server", "error");
    }
  }

  function openMoveModal(file) {
    setMenuOpen(null);
    setMoveModal(file);
  }

  function openShareModal(file) {
    setMenuOpen(null);
    setShareEmail("");
    setSharePermission("Read Only");
    setShareModal(file);
  }

  async function handleShare(e) {
    e.preventDefault();
    if (!shareModal || !shareEmail.trim()) return;
    setSharing(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileKey: shareModal.key,
          fileName: shareModal.name,
          email: shareEmail.trim(),
          permission: sharePermission,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Share failed", "error");
        return;
      }
      showToast(`"${shareModal.name}" shared with ${shareEmail.trim()}`);
      setShareModal(null);
      setShareEmail("");
    } catch {
      showToast("Cannot connect to server", "error");
    } finally {
      setSharing(false);
    }
  }

  function doMove(file, destinationPath) {
    setMoveModal(null);
    setConfirm({
      title: "Move file?",
      message: `Move "${file.name}" to the selected location?`,
      confirmLabel: "Move",
      danger: false,
      onConfirm: async () => {
        const token = localStorage.getItem("token");
        try {
          const res = await fetch(`${API_BASE}/api/files/move`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ key: file.key, destinationPath }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(data.error || "Move failed", "error");
            return;
          }
          showToast(`"${file.name}" moved`);
          load(path);
        } catch {
          showToast("Cannot connect to server", "error");
        }
      },
    });
  }

  const crumbs = breadcrumbParts();
  const root = getUserRootPath(user);
  const canGoUp = path !== root && path.length > root.length;

  const moveDestinations = [];
  if (canGoUp) {
    const trimmed = path.replace(/\/$/, "");
    const parts = trimmed.split("/");
    parts.pop();
    let parent = parts.join("/") + "/";
    if (!parent.startsWith(root)) parent = root;
    moveDestinations.push({ key: parent, name: "← Parent folder" });
  }
  folders.forEach((f) => {
    moveDestinations.push({ key: f.key, name: `📁 ${f.name}` });
  });

  return (
    <div>
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 360,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "error" ? "#991b1b" : "#0f172a",
              color: "#fff",
              padding: "12px 16px",
              borderRadius: 10,
              fontSize: "0.9rem",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 className="page-heading">My Files</h2>
          <p className="page-subtext">Files and folders in your SecureDrive workspace.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={uploadInputRef} type="file" hidden onChange={handleUploadHere} />
          <button className="btn btn-outline" type="button" onClick={() => uploadInputRef.current?.click()}>
            Upload here
          </button>
          <button className="btn btn-solid" type="button" onClick={() => setFolderModal(true)}>
            + New folder
          </button>
        </div>
      </div>

      <div
        style={{
          margin: "12px 0 16px",
          fontSize: "0.9rem",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: "4px 10px", fontSize: "0.8rem" }}
          onClick={() => {
            setPath(root);
            load(root);
          }}
        >
          My Files
        </button>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ fontWeight: i === crumbs.length - 1 ? 600 : 400 }}>{c}</span>
          </span>
        ))}
        {canGoUp && (
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: "4px 10px", fontSize: "0.8rem", marginLeft: 8 }}
            onClick={goUp}
          >
            ↑ Up
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 12, fontSize: "0.85rem" }}>{error}</div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">This folder is empty</div>
            <div className="empty-state-text">Create a folder or use Upload here.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Modified</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {folders.map((folder) => (
                <tr key={folder.key}>
                  <td
                    style={{ fontWeight: 600, cursor: "pointer" }}
                    onClick={() => openFolder(folder.key)}
                  >
                    <span style={{ marginRight: 8 }}>📁</span>
                    {folder.name}
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                      onClick={() => openFolder(folder.key)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}

              {files.map((f) => (
                <tr key={f.key}>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ marginRight: 8 }}>
                      {favoriteKeys.has(f.key) ? "⭐ " : ""}
                      {f.type === "pdf" ? "📄" : f.type === "image" ? "🖼️" : "📎"}
                    </span>
                    {f.name}
                  </td>
                  <td>{formatSize(f.size)}</td>
                  <td>{formatDate(f.lastModified)}</td>
                  <td style={{ textAlign: "right", position: "relative" }}>
                    <div ref={menuOpen === f.key ? menuRef : null} style={{ display: "inline-block" }}>
                      <button
                        type="button"
                        title="More"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(menuOpen === f.key ? null : f.key);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontSize: 18,
                          padding: "4px 10px",
                          lineHeight: 1,
                        }}
                      >
                        ⋮
                      </button>
                      {menuOpen === f.key && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "100%",
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                            minWidth: 200,
                            zIndex: 50,
                            padding: 6,
                            textAlign: "left",
                          }}
                        >
                          {canPreview(f.name) && (
                            <MenuItem
                              label="Preview"
                              onClick={() => {
                                setMenuOpen(null);
                                setPreviewFile({ key: f.key, name: f.name });
                              }}
                            />
                          )}
                          <MenuItem label="Download" onClick={() => requestDownload(f)} />
                          <MenuItem
                            label={favoriteKeys.has(f.key) ? "Remove favorite" : "Add to favorites"}
                            onClick={() => toggleFavorite(f)}
                          />
                          <MenuItem label="Share…" onClick={() => openShareModal(f)} />
                          <MenuItem label="Move to folder…" onClick={() => openMoveModal(f)} />
                          <MenuItem label="Move to trash" danger onClick={() => requestTrash(f)} />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {folderModal && (
        <Modal onClose={() => setFolderModal(false)}>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem" }}>New folder</h3>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "0.9rem" }}>
            Create a folder in the current location.
          </p>
          <form onSubmit={handleCreateFolder}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Folder name</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Project"
              style={inputStyle}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setFolderModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-solid" disabled={creating || !folderName.trim()}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {shareModal && (
        <Modal onClose={() => setShareModal(null)}>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem" }}>Share file</h3>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "0.9rem" }}>
            Share <b>{shareModal.name}</b> with a team member.
          </p>
          <form onSubmit={handleShare}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Email</label>
            <input
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="colleague@tentee.com"
              style={inputStyle}
              required
              autoFocus
            />
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginTop: 12 }}>
              Permission
            </label>
            <select
              value={sharePermission}
              onChange={(e) => setSharePermission(e.target.value)}
              style={{ ...inputStyle, marginTop: 6 }}
            >
              <option value="Read Only">Read Only</option>
              <option value="Read & Write">Read & Write</option>
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShareModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-solid" disabled={sharing || !shareEmail.trim()}>
                {sharing ? "Sharing…" : "Share"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {moveModal && (
        <Modal onClose={() => setMoveModal(null)}>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem" }}>Move file</h3>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "0.9rem" }}>
            Choose where to move <b>{moveModal.name}</b>
          </p>
          {moveDestinations.length === 0 ? (
            <p style={{ color: "#64748b" }}>No folder available. Create a folder first.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {moveDestinations.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => doMove(moveModal, d.key)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => setMoveModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem" }}>{confirm.title}</h3>
          <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "0.95rem" }}>{confirm.message}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-solid"
              style={confirm.danger ? { background: "#dc2626", borderColor: "#dc2626" } : undefined}
              onClick={() => {
                const fn = confirm.onConfirm;
                setConfirm(null);
                fn?.();
              }}
            >
              {confirm.confirmLabel}
            </button>
          </div>
        </Modal>
      )}

      {previewFile && (
        <FilePreviewModal
          fileKey={previewFile.key}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        border: "none",
        background: "transparent",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: "0.9rem",
        color: danger ? "#dc2626" : "#0f172a",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#f1f5f9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginTop: 6,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};