import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

export default function ActivityLog() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Seuls Super Admin et Manager
  useEffect(() => {
    if (user && user.role !== "Super Admin" && user.role !== "Manager") {
      navigate("/admin/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/activity`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not load activity");
          return;
        }
        setActivities(data.activities || []);
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
      <h2 className="page-heading">Activity Log</h2>
      <p className="page-subtext">
        Recent actions across SecureDrive (uploads, shares, admin actions…).
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
              Actions like uploads will appear here once logged.
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
                  <td style={{ fontWeight: 600 }}>{a.user_name || (a.user_id ? `User #${a.user_id}` : "—")}</td>
                  <td>{a.action}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{a.detail || "—"}</td>
                  <td>{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}