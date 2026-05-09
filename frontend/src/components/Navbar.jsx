import { Link } from "react-router-dom";

export default function Navbar({ theme, toggleTheme }) {
  return (
    <header className="site-header">
      <div className="site-brand">
        <Link to="/" className="site-logo">
          <span className="logo-icon">🎬</span>
          <span>SyncFlick</span>
        </Link>
        <p className="site-tag">Watch together in sync</p>
      </div>

      <nav className="site-actions" aria-label="Primary navigation">
        <Link to="/" className="nav-link">
          Home
        </Link>
        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
        </button>
      </nav>
    </header>
  );
}
