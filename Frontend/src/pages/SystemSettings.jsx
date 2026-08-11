import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function SystemSettings() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Super Admin only
  useEffect(() => {
    if (user && user.role !== "Super Admin") {
      navigate("/admin/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setStats(data.stats || null);
      } catch {
        // ignore — page still shows static info
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <h2 className="page-heading">System Settings</h2>
      <p className="page-subtext">
        Global configuration and platform information (Super Admin only).
      </p>

      <div className="dashboard-grid" style={{ marginTop: 8 }}>
        {/* Platform */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Platform</span>
          </div>
          <InfoRow label="Application" value="SecureDrive" />
          <InfoRow label="Environment" value="Development" />
          <InfoRow label="Frontend" value="React + Vite" />
          <InfoRow label="Backend" value="Node.js + Express" />
          <InfoRow label="Database" value="PostgreSQL (Neon)" />
        </div>

        {/* Storage */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Storage (S3)</span>
          </div>
          <InfoRow label="Provider" value="Amazon S3" />
          <InfoRow label="Bucket" value="drivetentee" />
          <InfoRow label="Encryption" value="AES-256 (SSE-S3)" />
          <InfoRow label="Access model" value="Backend proxy (Method 2)" />
          <InfoRow
            label="Files in S3"
            value={loading ? "…" : stats ? String(stats.filesCount) : "—"}
          />
          <InfoRow
            label="Storage used"
            value={loading ? "…" : stats ? formatBytes(stats.storageBytes) : "—"}
          />
        </div>

        {/* Security */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Security</span>
          </div>
          <InfoRow label="Authentication" value="JWT + bcrypt" />
          <InfoRow label="Session" value="Token ~8 hours" />
          <InfoRow label="File isolation" value="uploads/{userId}/" />
          <InfoRow label="Share permissions" value="Read Only / Read & Write" />
          <InfoRow label="AssumeRole (STS)" value="Pending IAM setup" />
        </div>

        {/* Roles */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Application roles</span>
          </div>
          <InfoRow label="Super Admin" value="Full access + settings" />
          <InfoRow label="Manager" value="Users + files + activity" />
          <InfoRow label="User" value="Own files + shares" />
          <InfoRow
            label="Total users"
            value={loading ? "…" : stats ? String(stats.totalUsers) : "—"}
          />
          <InfoRow
            label="Active accounts"
            value={loading ? "…" : stats ? String(stats.activeAccounts) : "—"}
          />
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <span className="panel-title">Notes</span>
        </div>
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
          System Settings displays current platform configuration. Editable
          options (quotas, allowed file types, password policy) can be added
          later. AssumeRole will be enabled once the AWS IAM role ARN is
          provided by the administrator.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid var(--border, #e2e8f0)",
        fontSize: "0.9rem",
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}