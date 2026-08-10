import { useState } from "react";
import { useOutletContext } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const ICONS = {
  pdf: "📄",
  image: "🖼️",
  doc: "📝",
  sheet: "📊",
  slides: "📑",
  code: "🧩",
  file: "📁",
};

export default function MyFiles() {
  const { files, setFiles } = useOutletContext();

  const [shareModal, setShareModal] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("Read Only");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");

  const [trashModal, setTrashModal] = useState(null);
  const [trashing, setTrashing] = useState(false);

  async function handleDownload(file) {
    const fileKey = file.fileKey || file.key || file.id;
    if (!fileKey) {
      alert("Missing file key");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must be logged in");
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/files/download?key=${encodeURIComponent(fileKey)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Download failed");
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
    } catch {
      alert("Cannot connect to server");
    }
  }

  async function handleToggleFavorite(file) {
    const fileKey = file.fileKey || file.key || file.id;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileKey,
          fileName: file.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not add to favorites");
        return;
      }
      alert(data.message || "Added to favorites");
    } catch {
      alert("Cannot connect to server");
    }
  }

  async function confirmMoveToTrash() {
    if (!trashModal) return;
    const file = trashModal;
    const fileKey = file.fileKey || file.key || file.id;
    if (!fileKey) return;

    setTrashing(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/files/trash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: fileKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not move to trash");
        return;
      }
      if (typeof setFiles === "function") {
        setFiles((prev) =>
          prev.filter((f) => (f.fileKey || f.key || f.id) !== fileKey)
        );
      } else {
        window.location.reload();
      }
      setTrashModal(null);
    } catch {
      alert("Cannot connect to server");
    } finally {
      setTrashing(false);
    }
  }

  function openShareModal(file) {
    setShareModal(file);
    setShareEmail("");
    setSharePermission("Read Only");
    setShareError("");
    setShareSuccess("");
  }

  function closeShareModal() {
    setShareModal(null);
    setShareError("");
    setShareSuccess("");
  }

  async function handleShare(e) {
    e.preventDefault();
    if (!shareModal || !shareEmail) return;

    setSharing(true);
    setShareError("");
    setShareSuccess("");

    const fileKey = shareModal.fileKey || shareModal.key || shareModal.id;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE}/api/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileKey,
          fileName: shareModal.name,
          email: shareEmail,
          permission: sharePermission,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShareError(data.error || "Could not share file");
        setSharing(false);
        return;
      }
      setShareSuccess(`Shared with ${shareEmail} (${sharePermission})`);
      setSharing(false);
      setTimeout(() => closeShareModal(), 1500);
    } catch {
      setShareError("Cannot connect to server");
      setSharing(false);
    }
  }

  return (
    <div>
      <h2 className="page-heading">My Files</h2>
      <p className="page-subtext">
        Manage and organize your uploaded documents and media.
      </p>

      <div className="table-card">
        {!files || files.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Last Modified</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div className="file-name-cell">
                      <span>{ICONS[f.type] || ICONS.file}</span> {f.name}
                    </div>
                  </td>
                  <td>{f.size}</td>
                  <td>{f.modified}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title="Download"
                        onClick={() => handleDownload(f)}
                      >
                        <DownloadIcon />
                      </button>
                      <button
                        className="icon-btn"
                        title="Add to Favorites"
                        onClick={() => handleToggleFavorite(f)}
                      >
                        ⭐
                      </button>
                      <button
                        className="icon-btn"
                        title="Share"
                        onClick={() => openShareModal(f)}
                      >
                        <ShareIcon />
                      </button>
                      <button
                        className="icon-btn"
                        title="Move to Trash"
                        onClick={() => setTrashModal(f)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Move to Trash */}
      {trashModal && (
        <div
          className="modal-overlay"
          onClick={() => !trashing && setTrashModal(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Move to trash?</div>
            <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
              <b>"{trashModal.name}"</b> will be moved to trash. You can restore
              it later from the Trash page.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                disabled={trashing}
                onClick={() => setTrashModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={trashing}
                onClick={confirmMoveToTrash}
              >
                {trashing ? "Moving…" : "Move to trash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Share */}
      {shareModal && (
        <div className="modal-overlay" onClick={closeShareModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Share file</div>
            <div className="modal-subtitle">
              Share <b>{shareModal.name}</b> with a team member.
            </div>
            <form onSubmit={handleShare}>
              <div className="form-group">
                <label className="form-label">Recipient email</label>
                <input
                  className="form-input"
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="colleague@tentee.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Permission</label>
                <select
                  className="form-input"
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                >
                  <option value="Read Only">Read Only (view & download)</option>
                  <option value="Read & Write">Read & Write (can modify)</option>
                </select>
              </div>
              {shareError && (
                <div style={{ color: "#ef4444", marginBottom: 12, fontSize: "0.85rem" }}>
                  {shareError}
                </div>
              )}
              {shareSuccess && (
                <div style={{ color: "#16a34a", marginBottom: 12, fontSize: "0.85rem" }}>
                  {shareSuccess}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeShareModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-solid" disabled={sharing}>
                  {sharing ? "Sharing…" : "Share"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <FolderIcon />
      </div>
      <div className="empty-state-title">No files yet</div>
      <div className="empty-state-text">
        Upload your first file to get started with SecureDrive.
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v12M6 12l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8.2 10.8L15.8 7.2M8.2 13.2l7.6 3.6" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13" />
    </svg>
  );
}