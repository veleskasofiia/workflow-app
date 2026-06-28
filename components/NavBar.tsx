"use client";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

type Notif = { id: string; title: string; body: string | null; read: boolean; created_at: string };

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
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [muted, setMuted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const unread = muted ? 0 : notifs.filter(n => !n.read).length;

  const loadNotifs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifs(data as Notif[]);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("flowboard_theme");
    const dark = stored === "dark";
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    setMuted(localStorage.getItem("flowboard_notif_muted") === "1");
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("flowboard_notif_muted", next ? "1" : "0");
  }

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => clearInterval(interval);
  }, [loadNotifs]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
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

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function fmtTime(ts: string) {
    const d = new Date(ts);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <header className="app-nav">
      <a href="/dashboard" className="app-nav-logo">
        <Image src="/logo.svg" alt="FlowBoard" width={30} height={30} />
        <span>FlowBoard</span>
      </a>
      <nav className="app-nav-links">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className={`app-nav-link${pathname === link.href ? " active" : ""}`}>
            {link.label}
          </a>
        ))}
      </nav>
      <button className="app-nav-theme" onClick={toggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
        {isDark ? "☀️" : "🌙"}
      </button>

      {/* Bell */}
      <div ref={bellRef} style={{ position: "relative" }}>
        <button className="app-nav-bell" onClick={() => { setBellOpen(v => !v); if (!bellOpen) loadNotifs(); }} title={muted ? "Notifications muted" : "Notifications"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            {muted && <line x1="1" y1="1" x2="23" y2="23" />}
            {!muted && unread > 0 && <circle cx="19" cy="5" r="4" fill="#6366f1" stroke="#1e293b" strokeWidth="1.5" />}
          </svg>
          {!muted && unread > 0 && <span className="app-nav-bell-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>
        {bellOpen && (
          <div className="app-nav-notif-dropdown">
            <div className="app-nav-notif-header">
              <span>Notifications</span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {!muted && unread > 0 && <button className="app-nav-notif-markall" onClick={markAllRead}>Mark all read</button>}
                <button className="app-nav-notif-markall" onClick={toggleMute} title={muted ? "Unmute" : "Mute"}>
                  {muted ? "Unmute 🔔" : "Mute 🔕"}
                </button>
              </div>
            </div>
            {notifs.length === 0 ? (
              <div className="app-nav-notif-empty">No notifications yet</div>
            ) : (
              notifs.map(n => (
                <div key={n.id} className={`app-nav-notif-item${n.read ? "" : " unread"}`} onClick={() => markRead(n.id)}>
                  <div className="app-nav-notif-title">{n.title}</div>
                  {n.body && <div className="app-nav-notif-body">{n.body}</div>}
                  <div className="app-nav-notif-time">{fmtTime(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* User menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button className="app-nav-user-btn" onClick={() => setMenuOpen(v => !v)}>
          <span className="app-nav-user-avatar">U</span>
          <span className="app-nav-user-chevron">{menuOpen ? "▲" : "▼"}</span>
        </button>
        {menuOpen && (
          <div className="app-nav-dropdown">
            <button className="app-nav-dropdown-item" onClick={handleSettings}>⚙ Settings</button>
            <div className="app-nav-dropdown-divider" />
            <button className="app-nav-dropdown-item danger" onClick={handleSignOut}>Sign Out</button>
          </div>
        )}
      </div>
    </header>
  );
}
