import  { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./splash.css";

export default function Splash() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 4;
      });
    }, 40);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => navigate("/login"), 350);
      return () => clearTimeout(t);
    }
  }, [progress, navigate]);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-icon">
          <ShieldIcon />
        </div>
        <h1 className="splash-title">
          Secure<span>Drive</span>
        </h1>
        <p className="splash-subtitle">Enterprise File Platform &middot; v3.4.1</p>

        <div className="splash-progress-track">
          <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="splash-status">
          {progress < 100 ? "Loading secure environment…" : "Ready."}
        </p>
      </div>

      <button className="splash-skip" onClick={() => navigate("/login")}>
        Continue to Login &rarr;
      </button>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
    </svg>
  );
}
