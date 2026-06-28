"use client";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/connect",   label: "Connect Apps" },
  { href: "/workflow",  label: "Workflow Builder" },
];

export default function NavBar({ onSignOut, onSettings }: { onSignOut?: () => void; onSettings?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("flowboard_theme");
    const dark = stored === "dark";
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? "dark" : "light";
    localStorage.setItem("flowboard_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  async function handleSignOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    if (onSignOut) onSignOut();
    else router.push("/");
  }

  function handleSettings() {
    setMenuOpen(false);
    if (onSettings) onSettings();
  }

  return (
    <header className="app-nav">
      <a href="/dashboard" className="app-nav-logo">
        <Image src="/logo.svg" alt="FlowBoard" width={30} height={30} />
        <span>FlowBoard</span>
      </a>
      <nav className="app-nav-links">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`app-nav-link${pathname === link.href ? " active" : ""}`}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <button
        className="app-nav-theme"
        onClick={toggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? "☀️" : "🌙"}
      </button>

      {/* User menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button className="app-nav-user-btn" onClick={() => setMenuOpen(v => !v)}>
          <span className="app-nav-user-avatar">U</span>
          <span className="app-nav-user-chevron">{menuOpen ? "▲" : "▼"}</span>
        </button>
        {menuOpen && (
          <div className="app-nav-dropdown">
            <button className="app-nav-dropdown-item" onClick={handleSettings}>
              ⚙ Settings
            </button>
            <div className="app-nav-dropdown-divider" />
            <button className="app-nav-dropdown-item danger" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
