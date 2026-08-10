import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Login.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = newPassword.length >= 8 && passwordsMatch && token;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Reset failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch {
      setError("Cannot connect to server");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-panel-right" style={{ margin: "auto" }}>
          <div className="login-form">
            <h2 className="login-form-title">Invalid link</h2>
            <p className="login-form-subtitle">This reset link is missing or invalid.</p>
            <button className="login-submit-btn" onClick={() => navigate("/login")}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-panel-right" style={{ margin: "auto" }}>
        <form className="login-form" onSubmit={handleSubmit}>
          <h2 className="login-form-title">Reset password</h2>
          <p className="login-form-subtitle">Choose a new password for your account.</p>

          <label className="login-label">New Password</label>
          <div className="login-input-wrap">
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <label className="login-label">Confirm Password</label>
          <div className="login-input-wrap">
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {confirmPassword && !passwordsMatch && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem" }}>Passwords do not match.</p>
          )}
          {error && (
            <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 14 }}>{error}</div>
          )}
          {success && (
            <div style={{ color: "#16a34a", marginBottom: 12, fontSize: 14 }}>
              Password reset successfully. Redirecting to login…
            </div>
          )}

          <button type="submit" className="login-submit-btn" disabled={!canSubmit || loading}>
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}