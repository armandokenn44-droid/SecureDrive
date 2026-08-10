import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import UploadFile from "./UploadFile.jsx";
import "./AdminDashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const PAGE_META = {
  "/admin/dashboard": { title: "Dashboard", breadcrumbs: ["SecureDrive", "Dashboard"], upload: true },
  "/admin/files": { title: "My Files", breadcrumbs: ["SecureDrive", "My Files"], upload: true },
  "/admin/shared-with-me": { title: "Shared With Me", breadcrumbs: ["SecureDrive", "Shared With Me"], upload: false },
  "/admin/shared-by-me": { title: "Shared By Me", breadcrumbs: ["SecureDrive", "Shared By Me"], upload: false },
  "/admin/recent": { title: "Recent", breadcrumbs: ["SecureDrive", "Recent"], upload: false },
  "/admin/favorites": { title: "Favorites", breadcrumbs: ["SecureDrive", "Favorites"], upload: false },
  "/admin/trash": { title: "Trash", breadcrumbs: ["SecureDrive", "Trash"], upload: false },
  "/admin/users": { title: "User Management", breadcrumbs: ["SecureDrive", "Administration", "Users"], upload: false },
  "/admin/activity": { title: "Activity Log", breadcrumbs: ["SecureDrive", "Administration", "Activity"], upload: false },
  "/admin/settings": { title: "System Settings", breadcrumbs: ["SecureDrive", "Administration", "Settings"], upload: false },
  "/admin/profile": { title: "My Account", breadcrumbs: ["SecureDrive", "My Account"], upload: false },
};

const ROLE_AVATAR_COLOR = {
  "Super Admin": "#2563eb",
  Manager: "#7c3aed",
  Editor: "#d97706",
  User: "#0891b2",
};

function buildDisplayUser(rawUser) {
  const fullName = `${rawUser.firstName} ${rawUser.lastName}`;
  const initials = ((rawUser.firstName?.[0] || "") + (rawUser.lastName?.[0] || "")).toUpperCase();

  return {
    ...rawUser,
    fullName,
    initials,
    avatarColor: ROLE_AVATAR_COLOR[rawUser.role] || "#64748b",
    employeeId: rawUser.employeeId || "—",
    department: rawUser.department || "—",
    status: "Active",
    storageUsedGB: 0,
    storageTotalGB: 25,
    filesOwned: 0,
    sharedByMeCount: 0,
    lastLogin: "Just now",
  };
}

// Transforme un objet S3 en format que l'interface attend
function mapS3File(item) {
  const rawName = item.key.includes("/") ? item.key.split("/").pop() : item.key;
  if (!rawName) return null;

  // Enlève le UUID du début (ex: 151d0e1e-d203-...-test.docx → test.docx)
  const name = rawName.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    ""
  );

  const ext = name.split(".").pop()?.toLowerCase() || "";
  let type = "file";
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) type = "image";
  else if (["doc", "docx"].includes(ext)) type = "doc";
  else if (["xls", "xlsx"].includes(ext)) type = "sheet";
  else if (["ppt", "pptx"].includes(ext)) type = "slides";
  else if (["json", "js", "jsx", "ts", "css"].includes(ext)) type = "code";
  else if (ext === "pdf") type = "pdf";

  const size =
    item.size < 1024
      ? `${item.size} B`
      : item.size < 1024 * 1024
      ? `${(item.size / 1024).toFixed(0)} KB`
      : `${(item.size / (1024 * 1024)).toFixed(1)} MB`;

  const modified = item.lastModified
    ? new Date(item.lastModified).toLocaleDateString("fr-FR")
    : "—";

  return {
    id: item.key,
    name: name || rawName, // si le regex ne match pas, on garde le nom brut
    type,
    size,
    modified,
    starred: false,
    fileKey: item.key,
  };
}
export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Charger l'utilisateur connecté
  useEffect(() => {
    const token = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");

    if (!token || !rawUser) {
      navigate("/login");
      return;
    }

    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(buildDisplayUser(JSON.parse(rawUser)));
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  // Charger les vrais fichiers depuis S3
  useEffect(() => {
    async function loadFiles() {
      setFilesLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/files`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();

        if (res.ok && data.files) {
          const mapped = data.files.map(mapS3File).filter(Boolean);
          setFiles(mapped);
        }
      } catch (err) {
        console.error("Could not load files from S3:", err);
      } finally {
        setFilesLoading(false);
      }
    }

    loadFiles();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const meta = PAGE_META[location.pathname] || { title: "SecureDrive", breadcrumbs: [], upload: false };

  function addFile(file) {
    setFiles((prev) => [file, ...prev]);
  }

  if (!user) return null;

  return (
    <div className="admin-shell">
      <Sidebar user={user} />
      <div className="admin-main">
        <Topbar
          title={meta.title}
          breadcrumbs={meta.breadcrumbs}
          user={user}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onUploadClick={meta.upload ? () => setUploadOpen(true) : null}
        />
        <div className="admin-content">
          <Outlet context={{ user, files, addFile, filesLoading }} />
        </div>
      </div>

      {uploadOpen && (
        <UploadFile onClose={() => setUploadOpen(false)} onUpload={addFile} />
      )}
    </div>
  );
}