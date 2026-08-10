import { useEffect, useState, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function SharedWithMe() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replacingId, setReplacingId] = useState(null);
  const fileInputRef = useRef(null);
  const pendingReplaceRef = useRef(null); // { fileKey, shareId }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    loadShares();
  }, []);

  async function loadShares() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/shares/with-me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load shared files");
        return;
      }
      setShares(data.shares || []);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(item) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_BASE}/api/files/download?key=${encodeURIComponent(item.file_key)}`,
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
      a.download = item.file_name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Cannot connect to server");
    }
  }

  // Ouvre le sélecteur de fichier pour remplacer
  function startReplace(item) {
    pendingReplaceRef.current = {
      fileKey: item.file_key,
      shareId: item.id,
    };
    fileInputRef.current?.click();
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    const pending = pendingReplaceRef.current;
    e.target.value = ""; // reset input

    if (!file || !pending) return;

    setReplacingId(pending.shareId);
    const token = localStorage.getItem("token");

    try {
      const formData = new FormData();
      formData.append("key", pending.fileKey);
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/files/replace`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Ne pas mettre Content-Type : le navigateur le gère avec FormData
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not update file");
        return;
      }

      alert("File updated successfully on SecureDrive");
    } catch {
      alert("Cannot connect to server");
    } finally {
      setReplacingId(null);
      pendingReplaceRef.current = null;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  }

  return (
    <div>
      <h2 className="page-heading">Shared With Me</h2>
      <p className="page-subtext">
        Files and folders that other team members shared with you.
      </p>

      {/* Input caché pour choisir le fichier de remplacement */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={onFileChosen}
      />

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 12 }}>{error}</div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
        ) : shares.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShareIcon />
            </div>
            <div className="empty-state-title">Nothing shared with you yet</div>
            <div className="empty-state-text">
              Files shared by teammates will show up here.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Shared By</th>
                <th>Permissions</th>
                <th>Date Shared</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.file_name}</td>
                  <td>
                    {item.owner_first_name} {item.owner_last_name}
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {item.owner_email}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`tag ${
                        item.permission === "Read Only"
                          ? "tag-gray"
                          : "tag-amber"
                      }`}
                    >
                      {item.permission}
                    </span>
                  </td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title="Download"
                        onClick={() => handleDownload(item)}
                      >
                        <DownloadIcon />
                      </button>

                      {/* Bouton Update uniquement si Read & Write */}
                      {item.permission === "Read & Write" && (
                        <button
                          className="btn btn-outline"
                          title="Replace file on SecureDrive"
                          disabled={replacingId === item.id}
                          onClick={() => startReplace(item)}
                          style={{ marginLeft: 6, fontSize: "0.8rem" }}
                        >
                          {replacingId === item.id
                            ? "Updating…"
                            : "Update file"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8.2 10.8L15.8 7.2M8.2 13.2l7.6 3.6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 4v12M6 12l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}