import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function ActivityLog() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Seuls Super Admin et Manager ont accès
  useEffect(() => {
    if (user && user.role !== "Super Admin" && user.role !== "Manager") {
      navigate("/admin/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    loadActivity();
  }, []);

  async function loadActivity() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load activity log");
        return;
      }
      // On force la lecture directe de user_name renvoyé par le backend
      setActivities(data.activities || []);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    return (
      d.toLocaleDateString("fr-FR") +
      " " +
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    );
  }

  function displayUser(a) {
    // user_name doit déjà être un vrai email venant du backend.
    // Ce filet de sécurité n'affiche "User #id" QUE si vraiment rien n'est venu.
    if (a.user_name && a.user_name.trim().length > 0) {
      return a.user_name;
    }
    return a.user_id ? `User #${a.user_id}` : "System";
  }

  return (
    <div>
      <h2 className="page-heading">Activity Log</h2>
      <p className="page-subtext">
        Recent actions across SecureDrive ({activities.length} entries).
      </p>

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 12, fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
        ) : activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No activity yet</div>
            <div className="empty-state-text">
              Upload a file or share a document — actions will appear here.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Detail</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{displayUser(a)}</td>
                  <td>{a.action}</td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {a.detail || "—"}
                  </td>
                  <td>{formatDateTime(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}