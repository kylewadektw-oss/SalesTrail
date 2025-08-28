"use client";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/feed", label: "Feed" },
  { href: "/map", label: "Map" },
  { href: "/route", label: "Route Planner" },
  { href: "/favorites", label: "Favorites" },
  { href: "/profile", label: "Profile" },
  { href: "/alerts", label: "Alerts" },
  { href: "/about", label: "About" },
];

export default function ClientNav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: "1.25rem",
        padding: "0.875rem 2rem",
        borderBottom: "1px solid var(--border)",
        marginBottom: "2rem",
        background: "var(--muted)",
      }}
    >
      {navLinks.map((link) => (
        <button
          key={link.href}
          type="button"
          onClick={() => window.location.assign(link.href)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") window.location.assign(link.href);
          }}
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            textDecoration: "none",
            color: "var(--foreground)",
            fontWeight: 600,
            fontSize: "0.975rem",
            letterSpacing: "0.005em",
            padding: "0.25rem 0.35rem",
            borderRadius: 6,
            userSelect: "none",
            cursor: "pointer",
          }}
        >
          {link.label}
        </button>
      ))}
    </nav>
  );
}
