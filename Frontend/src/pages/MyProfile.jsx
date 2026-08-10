import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import "./Login.css";

function getStrength(pwd) {
  const checks = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const classes = ["", "filled-weak", "filled-fair", "filled-good", "filled-strong"];
  return { checks, score, label: labels[score], barClass: classes[score] };
}

const TABS = ["Profile", "Security", "Sessions", "Privacy"];

export default function MyProfile() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Security");

  const storagePct = Math.round((user.storageUsedGB / user.storageTotalGB) * 100);

  function handleSignOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  return (
    <div>
      <h2 className="page-heading">My Account</h2>
      <p className="page-subtext">Manage your profile, security, and privacy preferences.</p>

      <div className="profile-banner-card">
        <div className="profile-banner" />
        <div className="profile-banner-body">
          <div>
            <div className="profile-avatar-lg" style={{ background: user.avatarColor }}>
              {user.initials}
            </div>
          </div>
          <button className="btn btn-outline">✎ Edit Profile</button>
        </div>
        <div style={{ padding: "0 24px 20px" }}>
          <div className="profile-name">{user.fullName}</div>
          <div className="profile-email">{user.email}</div>
        </div>
        <div className="profile-meta-row">
          <div>
            <div className="profile-meta-label">Employee ID</div>
            <div className="profile-meta-value">{user.employeeId}</div>
          </div>
          <div>
            <div className="profile-meta-label">Role</div>
            <div className="profile-meta-value">{user.role}</div>
          </div>
          <div>
            <div className="profile-meta-label">Department</div>
            <div className="profile-meta-value">{user.department}</div>
          </div>
          <div>
            <div className="profile-meta-label">Status</div>
            <div className="profile-meta-value">{user.status}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Storage Usage</span>
            <span className="tag tag-blue">{storagePct}%</span>
          </div>
          <div className="sidebar-storage-track" style={{ height: 6 }}>
            <div className="sidebar-storage-fill" style={{ width: `${storagePct}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <span>{user.storageUsedGB} GB used</span>
            <span>{(user.storageTotalGB - user.storageUsedGB).toFixed(1)} GB free</span>
            <span>{user.storageTotalGB} GB total</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Quick Stats</span></div>
          <div className="activity-row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Files owned</span><b>{user.filesOwned}</b>
          </div>
          <div className="activity-row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Shared by me</span><b>{user.sharedByMeCount}</b>
          </div>
          <div className="activity-row" style={{ display: "flex", justifyContent: "space-between", borderBottom: "none" }}>
            <span>Last login</span><b>{user.lastLogin}</b>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`profile-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="panel" style={{ maxWidth: 480 }}>
        {activeTab === "Profile" && <ProfileTab user={user} />}
        {activeTab === "Security" && <SecurityTab />}
        {activeTab === "Sessions" && <SessionsTab />}
        {activeTab === "Privacy" && <PrivacyTab />}
      </div>

      <button
        className="btn btn-danger"
        style={{ marginTop: 20 }}
        onClick={handleSignOut}
      >
        &#8618; Sign Out
      </button>
    </div>
  );
}

function ProfileTab({ user }) {
  return (
    <div>
      <div className="form-group">
        <label className="form-label">Full Name</label>
        <input className="form-input" defaultValue={user.fullName} />
      </div>
      <div className="form-group">
        <label className="form-label">Corporate Email</label>
        <input className="form-input" defaultValue={user.email} disabled />
      </div>
      <div className="form-group">
        <label className="form-label">Department</label>
        <input className="form-input" defaultValue={user.department} disabled />
      </div>
      <button className="btn btn-solid">Save Changes</button>
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { checks, score, label, barClass } = getStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = score === 4 && passwordsMatch && currentPassword.length > 0;

  async function handleSave(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:4000/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Cannot connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 18 }}>
        Your Super Admin created this account with a temporary password. Set your own
        password below to secure your account.
      </p>

      <div className="form-group">
        <label className="form-label">Current Password</label>
        <input
          type="password"
          className="form-input"
          placeholder="Password given by your admin"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">New Password</label>
        <input
          type="password"
          className="form-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {newPassword.length > 0 && (
          <>
            <div className="password-strength-track">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`password-strength-bar ${i < score ? barClass : ""}`} />
              ))}
            </div>
            <div className="password-strength-label" style={{ color: score === 4 ? "#16a34a" : "#64748b" }}>
              {label}
            </div>
          </>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Confirm New Password</label>
        <input
          type="password"
          className="form-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 6 }}>Passwords do not match.</p>
        )}
      </div>

      <div className="password-requirements">
        <div className="password-requirements-title">Password requirements:</div>
        <Requirement met={checks.length} text="At least 8 characters" />
        <Requirement met={checks.upper} text="One uppercase letter" />
        <Requirement met={checks.number} text="One number" />
        <Requirement met={checks.special} text="One special character" />
      </div>

      {error && (
        <div style={{ color: "#ef4444", marginTop: 12, fontSize: "0.82rem" }}>{error}</div>
      )}

      <button type="submit" className="btn btn-solid" style={{ marginTop: 16 }} disabled={!canSubmit || loading}>
        {saved ? "Password updated ✓" : loading ? "Updating..." : "Save New Password"}
      </button>
    </form>
  );
}

function Requirement({ met, text }) {
  return (
    <div className={`password-requirement ${met ? "met" : ""}`}>
      <span>{met ? "✓" : "○"}</span> {text}
    </div>
  );
}

function SessionsTab() {
  return (
    <div>
      <div className="activity-row">
        <div className="activity-text"><b>This device</b> — Chrome on Windows</div>
        <div className="activity-time">Active now</div>
      </div>
      <div className="activity-row" style={{ borderBottom: "none" }}>
        <div className="activity-text"><b>iPhone 15</b> — SecureDrive Mobile</div>
        <div className="activity-time">Last active 2 days ago</div>
      </div>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div>
      <p style={{ fontSize: "0.87rem", color: "var(--text-secondary)" }}>
        SecureDrive logs file access and sharing activity for audit compliance.
        Contact your administrator to request a copy of your personal data.
      </p>
    </div>
  );
}