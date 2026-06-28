"use client";
import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const APPS = [
  { key: "gmail",    label: "Gmail",            icon: "📧", color: "#ea4335" },
  { key: "outlook",  label: "Outlook Mail",     icon: "📨", color: "#0078d4" },
  { key: "ocal",     label: "Outlook Calendar", icon: "📆", color: "#0f6cbd" },
  { key: "calendar", label: "Google Calendar",  icon: "📅", color: "#4285f4" },
  { key: "gdrive",   label: "Google Drive",     icon: "📁", color: "#34a853" },
  { key: "tracker",  label: "Tracker",          icon: "📋", color: "#6366f1" },
  { key: "habits",   label: "Habit Tracker",    icon: "💪", color: "#8b5cf6" },
  { key: "budget",   label: "Budget",           icon: "💰", color: "#10b981" },
  { key: "pulse",    label: "Daily Pulse",      icon: "🌤️", color: "#f59e0b" },
];

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setAuthError(error.message);
    else setAuthSuccess(true);
  }

  return (
    <div>
      {/* ── Hero ── */}
      <header className="hero sticky-header">
        <div className="header-bar">
          <span className="logo-lockup">
            <Image src="/logo.svg" alt="FlowBoard logo" width={52} height={52} />
            <h1 className="site-title">FlowBoard</h1>
          </span>
          <div className="header-buttons">
            <a href="/auth/login" className="header-btn">Sign In</a>
            <a href="/workflow" className="header-btn">Workflow Builder</a>
            <a href="/dashboard" className="header-btn primary">Dashboard</a>
          </div>
        </div>

        <p className="hero-typewriter">Plan. Track. Automate.</p>
      </header>

      <div className="main-content">

        {/* ── Fade-up intro ── */}
        <section className="section-block fadeup-section">
          <h2 className="section-title fadeup" style={{ animationDelay: "0.1s" }}>
            Your productivity, all in one place
          </h2>
          <p className="section-subtitle fadeup" style={{ animationDelay: "0.25s" }}>
            Track habits, plan your week, manage your budget, and connect your apps — all from one dashboard.
          </p>
          <div className="fadeup hero-cta-row" style={{ animationDelay: "0.4s" }}>
            <a href="/auth/signup" className="hero-cta-btn-primary">Get Started Free</a>
            <a href="/auth/login" className="hero-cta-btn-secondary">Sign In</a>
          </div>
        </section>

        {/* ── Scrolling logos ── */}
        <section className="section-block" style={{ overflow: "hidden", padding: "2.5rem 0" }}>
          <div className="marquee-track">
            <div className="marquee-inner">
              {[...APPS, ...APPS].map((app, i) => (
                <div key={i} className="marquee-item">
                  <div
                    className="marquee-icon-badge"
                    style={{ background: `${app.color}18`, border: `2px solid ${app.color}30` }}
                  >
                    <span>{app.icon}</span>
                  </div>
                  <span className="marquee-label">{app.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tracker & Budget showcase ── */}
        <section className="section-block">
          <h2 className="section-title">Track your day & your budget</h2>
          <p className="section-subtitle" style={{ marginBottom: "2rem" }}>
            Plan every week, build daily habits, and stay on top of your finances — all in one place.
          </p>
          <div className="feature-showcase">
            <div className="showcase-card">
              <div className="showcase-icon">📅</div>
              <h3 className="showcase-title">Weekly Calendar</h3>
              <p className="showcase-desc">Add goals to each day, check them off, and copy tasks forward. Navigate any week — past or future.</p>
              <ul className="showcase-list">
                <li>✓ Per-day goals with checkmarks</li>
                <li>✓ Copy task to next day</li>
                <li>✓ Navigate months & years</li>
              </ul>
            </div>
            <div className="showcase-card">
              <div className="showcase-icon">💪</div>
              <h3 className="showcase-title">Habit Tracker</h3>
              <p className="showcase-desc">Log daily habits across the month. See your streaks and completion rate at a glance.</p>
              <ul className="showcase-list">
                <li>✓ Daily habit check-ins</li>
                <li>✓ Monthly grid view</li>
                <li>✓ Completion charts</li>
              </ul>
            </div>
            <div className="showcase-card">
              <div className="showcase-icon">💰</div>
              <h3 className="showcase-title">Budget Tracker</h3>
              <p className="showcase-desc">Log income and expenses, see your balance, and visualize spending by category.</p>
              <ul className="showcase-list">
                <li>✓ USD, EUR and CZK support</li>
                <li>✓ Pie & bar charts</li>
                <li>✓ 6-month history</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── App tiles ── */}
        <section className="section-block">
          <h2 className="section-title">Connect Your Apps</h2>
          <p className="section-subtitle">Sign up to start connecting your tools to FlowBoard.</p>
          <div className="app-tiles">
            {APPS.map((app) => (
              <button key={app.key} className={`app-tile ${app.key}`} onClick={() => router.push("/auth/signup")}>
                <span className="app-icon">{app.icon}</span>
                <span className="app-name">{app.label}</span>
                <span className="app-status">Connect →</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Why FlowBoard ── */}
        <section className="section-block why-section">
          <h2 className="section-title">Why use FlowBoard?</h2>
          <p className="why-text">
            FlowBoard brings all your essential tools into one simple, browser‑based dashboard.
            No extra installs, no complicated setup. Just one place to manage Gmail, Outlook,
            and Google Calendar — with smart automation built in.
          </p>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>🔗 Connect</h3>
              <p>Bring all your tools into one workspace with a single click.</p>
            </div>
            <div className="feature-card">
              <h3>📅 Track Daily Routines</h3>
              <p>Plan your week, check off daily goals, and build habits — all in one calendar view.</p>
            </div>
            <div className="feature-card">
              <h3>💰 Budget Tracker</h3>
              <p>Log income and expenses, visualize spending by category, and track your balance in USD, EUR, or CZK.</p>
            </div>
            <div className="feature-card">
              <h3>🤖 Automate</h3>
              <p>Let the AI agent handle repetitive tasks so you don&apos;t have to.</p>
            </div>
          </div>
        </section>

        {/* ── Signup ── */}
        <section className="section-block signup-section">
          <h2 className="section-title">Get Started for Free</h2>
          <p className="section-subtitle">Create your FlowBoard account in seconds.</p>
          {authSuccess ? (
            <div className="signup-success">
              <p>🎉 Account created! Check your email to confirm, then <a href="/auth/login">sign in</a>.</p>
            </div>
          ) : (
            <form className="signup-form" onSubmit={handleSignup} autoComplete="off">
              <input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
              <input type="password" placeholder="Choose a password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              {authError && <p className="auth-error">{authError}</p>}
              <button type="submit" disabled={loading}>{loading ? "Creating account…" : "Create Account"}</button>
              <p className="signin-link">Already have an account? <a href="/auth/login">Sign in</a></p>
            </form>
          )}
        </section>

      </div>

      <footer style={{ background: "#1e293b", color: "#94a3b8", textAlign: "center", padding: "1.25rem", fontSize: "0.85rem" }}>
        <p>© 2026 FlowBoard · <a href="/docs" style={{ color: "#93c5fd", textDecoration: "none" }}>Documentation</a> · <a href="/auth/login" style={{ color: "#93c5fd", textDecoration: "none" }}>Sign In</a></p>
      </footer>
    </div>
  );
}
