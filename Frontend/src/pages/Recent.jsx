import { useEffect, useState } from "react";

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

export default function Recent() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/favorites/recent`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not load recent files");
          return;
        }
        setFiles(data.files || []);
      } catch {
        setError("Cannot connect to server");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h2 className="page-heading">Recent</h2>
      <p className="page-subtext">
        Your most recently modified files.
      </p>

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 12 }}>{error}</div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No recent files</div>
            <div className="empty-state-text">
              Files you upload or modify will appear here.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.key}>
                  <td style={{ fontWeight: 600 }}>{f.name}</td>
                  <td>{formatSize(f.size)}</td>
                  <td>{formatDate(f.lastModified)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}