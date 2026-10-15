import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "../types";
import { Notice } from "../components/Notice";

const navigationItems = [
  { path: "/", label: "Discover", icon: "\u2733" },
  { path: "/group", label: "Your group", icon: "\u25c9" },
  { path: "/shortlist", label: "Shortlist & votes", icon: "\u2661" },
  { path: "/analytics", label: "Progress", icon: "\u2197" },
  { path: "/profile", label: "Preferences", icon: "\u2318" },
] as const;

export function AppLayout({
  user,
  logout,
  error,
  notice,
  setError,
  setNotice,
  children,
  modal,
}: {
  user: User;
  logout: () => Promise<void>;
  error: string;
  notice: string;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
  children: ReactNode;
  modal: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div className="app-layout min-h-screen font-sans">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => navigate("/")}>
          the hangover<span>.</span>
        </a>
        <div className="side-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {navigationItems.map(({ path, label, icon }) => (
            <button
              key={path}
              className={`nav-item ${location.pathname === path ? "active" : ""}`}
              onClick={() => navigate(path)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </span>
          </div>
          <button className="text-button signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="mobile-header">
          <span className="brand">
            the hangover<span>.</span>
          </span>
          <button className="text-button" onClick={logout}>
            Sign out
          </button>
        </header>
        <div className="content-wrap">
          {error && (
            <Notice type="error">
              {error}
              <button className="dismiss" onClick={() => setError("")}>
                \u00D7
              </button>
            </Notice>
          )}
          {notice && (
            <Notice type="success">
              {notice}
              <button className="dismiss" onClick={() => setNotice("")}>
                \u00D7
              </button>
            </Notice>
          )}
          {children}
        </div>
      </main>
      {modal}
    </div>
  );
}
