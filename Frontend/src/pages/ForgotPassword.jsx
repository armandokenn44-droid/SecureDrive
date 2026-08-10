import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetLink("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setMessage(data.message);
      // En dev seulement : le backend renvoie le lien pour tester
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-panel-right" style={{ margin: "auto" }}>
        <form className="login-form" onSubmit={handleSubmit}>
          <h2 className="login-form-title">Forgot password</h2>
          <p className="login-form-subtitle">
            Enter your email and we’ll generate a reset link.
          </p>

          <label className="login-label">Email</label>
          <div className="login-input-wrap">
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 14 }}>{error}</div>
          )}
          {message && (
            <div style={{ color: "#16a34a", marginBottom: 12, fontSize: 14 }}>{message}</div>
          )}
          {resetLink && (
            <div style={{ marginBottom: 12, fontSize: 13, wordBreak: "break-all" }}>
              <strong>Dev reset link:</strong>
              <br />
              <a href={resetLink}>{resetLink}</a>
            </div>
          )}

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>

          <p className="login-footer-note">
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                navigate("/login");
              }}
            >
              ← Back to Sign In
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}