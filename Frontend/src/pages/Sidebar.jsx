import { NavLink, useNavigate } from "react-router-dom";
import { ROLES } from "../data/mockData.js";

const FILE_NAV = [
  { to: "dashboard", label: "Dashboard", icon: GridIcon },
  { to: "files", label: "My Files", icon: FolderIcon },
  { to: "shared-with-me", label: "Shared With Me", icon: ShareIcon },
  { to: "shared-by-me", label: "Shared By Me", icon: SendIcon },
  { to: "recent", label: "Recent", icon: ClockIcon },
  { to: "favorites", label: "Favorites", icon: StarIcon },
  { to: "trash", label: "Trash", icon: TrashIcon },
];

const ADMIN_NAV = [
  { to: "users", label: "User Management", icon: UsersIcon, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER] },
  { to: "activity", label: "Activity Log", icon: ActivityIcon, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER] },
  { to: "settings", label: "System Settings", icon: SettingsIcon, roles: [ROLES.SUPER_ADMIN] },
];

export default function Sidebar({ user }) {
  const navigate = useNavigate();
  const adminItems = ADMIN_NAV.filter((item) => item.roles.includes(user.role));
  const storagePct = Math.round((user.storageUsedGB / user.storageTotalGB) * 100);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <ShieldIcon />
        </div>
        <div className="sidebar-brand-name">
          Secure<span>Drive</span>
        </div>
      </div>

      <div className="sidebar-section-label">Navigation</div>
      <nav className="sidebar-nav">
        {FILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={`/admin/${item.to}`}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          >
            <item.icon /> {item.label}
          </NavLink>
        ))}
      </nav>

      {adminItems.length > 0 && (
        <>
          <div className="sidebar-section-label">Administration</div>
          <nav className="sidebar-nav">
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={`/admin/${item.to}`}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              >
                <item.icon /> {item.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      <div className="sidebar-spacer" />

      <div className="sidebar-bottom">
        <div className="sidebar-storage-card">
          <div className="sidebar-storage-top">
            <span>Storage</span>
            <span>{user.storageUsedGB} / {user.storageTotalGB} GB</span>
          </div>
          <div className="sidebar-storage-track">
            <div className="sidebar-storage-fill" style={{ width: `${storagePct}%` }} />
          </div>
        </div>

        <div className="sidebar-user-card" onClick={() => navigate("/admin/profile")}>
          <div className="avatar-circle" style={{ background: user.avatarColor }}>
            {user.initials}
          </div>
          <div>
            <div className="sidebar-user-name">{user.fullName}</div>
            <div className="sidebar-user-role">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ShieldIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
    </svg>
  );
}
function iconProps() {
  return { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
}
function GridIcon() { return <svg {...iconProps()}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>; }
function FolderIcon() { return <svg {...iconProps()}><path d="M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6z"/></svg>; }
function ShareIcon() { return <svg {...iconProps()}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8L15.8 7.2M8.2 13.2l7.6 3.6"/></svg>; }
function SendIcon() { return <svg {...iconProps()}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>; }
function ClockIcon() { return <svg {...iconProps()}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>; }
function StarIcon() { return <svg {...iconProps()}><path d="M12 2l3.1 6.6 7.2.8-5.4 5 1.5 7.1L12 18.1 5.6 21.5l1.5-7.1-5.4-5 7.2-.8L12 2z"/></svg>; }
function TrashIcon() { return <svg {...iconProps()}><path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13"/></svg>; }
function UsersIcon() { return <svg {...iconProps()}><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 14.2c2.6.4 4.5 2.3 4.5 5.3"/></svg>; }
function ActivityIcon() { return <svg {...iconProps()}><path d="M3 12h4l2 8 4-16 2 8h6"/></svg>; }
function SettingsIcon() { return <svg {...iconProps()}><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 000-3l2-1.5-2-3.5-2.4 1a7.7 7.7 0 00-2.6-1.5L14 2h-4l-.4 2.5a7.7 7.7 0 00-2.6 1.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 000 3l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 002.6 1.5L10 22h4l.4-2.5a7.7 7.7 0 002.6-1.5l2.4 1 2-3.5-2-1.5z"/></svg>; }
