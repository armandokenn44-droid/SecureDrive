import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    loadFavorites();
  }, []);

  async function loadFavorites() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load favorites");
        return;
      }
      setFavorites(data.favorites || []);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(item) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileKey: item.file_key }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not remove favorite");
        return;
      }
      setFavorites((prev) => prev.filter((f) => f.id !== item.id));
    } catch {
      alert("Cannot connect to server");
    }
  }

  return (
    <div>
      <h2 className="page-heading">Favorites</h2>
      <p className="page-subtext">
        Files you starred for quick access.
      </p>

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 12 }}>{error}</div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
        ) : favorites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No favorites yet</div>
            <div className="empty-state-text">
              Star a file from My Files to see it here.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Added</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {favorites.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>⭐ {item.file_name}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn-outline"
                        onClick={() => handleRemove(item)}
                      >
                        Remove
                      </button>
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