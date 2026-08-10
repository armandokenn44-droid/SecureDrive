import React, {useState} from "react";
import { useNavigate } from "react-router-dom";
import { notifications as mockNotifications } from "../data/mockData.js";

export default function Topbar({ title, breadcrumbs = [], user, darkMode, onToggleDarkMode, onUploadClick }) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-left">
        {breadcrumbs.length > 0 && (
          <div className="breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb}>
                {i > 0 && <span>/</span>}
                <span className={i === breadcrumbs.length - 1 ? "crumb-current" : ""}>{crumb}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-search">
        <SearchIcon />
        <input type="text" placeholder="Search files, folders, users…" />
      </div>

      <div className="topbar-right">
        {onUploadClick && (
          <button className="btn-primary-upload" onClick={onUploadClick}>
            <UploadIcon /> Upload Files
          </button>
        )}

        <button className="icon-btn" onClick={onToggleDarkMode} aria-label="Toggle theme">
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>

        <button className="icon-btn" aria-label="Help">
          <HelpIcon />
        </button>

        <div style={{ position: "relative" }}>
          <button
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => setShowNotifications((s) => !s)}
          >
            <BellIcon />
            {mockNotifications.length > 0 && (
              <span className="notification-badge">{mockNotifications.length}</span>
            )}
          </button>
          {showNotifications && (
            <div
              style={{
                position: "absolute",
                top: 42,
                right: 0,
                width: 300,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                boxShadow: "var(--shadow-md)",
                padding: 12,
                zIndex: 20,
              }}
            >
              {mockNotifications.map((n) => (
                <div key={n.id} style={{ padding: "8px 4px", borderBottom: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.83rem", fontWeight: 700 }}>{n.title}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{n.detail}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>{n.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="topbar-user" onClick={() => navigate("/admin/profile")}>
          <div className="avatar-circle" style={{ background: user.avatarColor }}>
            {user.initials}
          </div>
          <div>
            <div className="topbar-user-name">{user.fullName}</div>
            <div className="topbar-user-role">{user.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function iconProps() {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
}
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>; }
function UploadIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/></svg>; }
function MoonIcon() { return <svg {...iconProps()}><path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z"/></svg>; }
function SunIcon() { return <svg {...iconProps()}><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>; }
function HelpIcon() { return <svg {...iconProps()}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 014.8 1c0 1.6-2.3 1.8-2.3 3.5"/><path d="M12 17.5h.01"/></svg>; }
function BellIcon() { return <svg {...iconProps()}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>; }
