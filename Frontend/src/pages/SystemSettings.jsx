export default function SystemSettings() {
  return (
    <div>
      <h2 className="page-heading">System Settings</h2>
      <p className="page-subtext">Platform-wide configuration — Super Admin only.</p>

      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="form-group">
          <div className="form-label">Storage provider</div>
          <div style={{ fontWeight: 700 }}>Amazon S3 (bucket: drivetentee)</div>
        </div>

        <div className="form-group">
          <div className="form-label">Session timeout</div>
          <div style={{ fontWeight: 700 }}>30 minutes of inactivity</div>
        </div>

        <div className="form-group">
          <div className="form-label">Password policy</div>
          <div style={{ fontWeight: 700 }}>8+ chars, uppercase, number, special character</div>
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "12px" }}>
          More configuration options (storage alerts, retention rules, SSO) will be added once the backend exists.
        </p>
      </div>
    </div>
  );
}
