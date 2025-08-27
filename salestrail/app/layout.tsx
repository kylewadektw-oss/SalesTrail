import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SalesTrail",
  description: "Find and plan local yard, estate, and garage sales.",
};

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
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
            <Link
              key={link.href}
              href={link.href}
              style={{
                textDecoration: "none",
                color: "var(--foreground)",
                fontWeight: 600,
                fontSize: "0.975rem",
                letterSpacing: "0.005em",
                padding: "0.25rem 0.35rem",
                borderRadius: 6,
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {children}
      </body>
    </html>
  );
}
