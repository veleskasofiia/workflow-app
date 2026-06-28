import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FlowBoard — Your personal productivity dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: 42, fontWeight: 700, color: "white", letterSpacing: "-1px" }}>
            FlowBoard
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "white",
            lineHeight: 1.1,
            marginBottom: "24px",
            maxWidth: 800,
          }}
        >
          Your personal productivity dashboard
        </div>

        {/* Sub */}
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.8)", marginBottom: "48px", maxWidth: 700 }}>
          Calendar · Habits · Budget · AI Assistant
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {["Supabase", "Composio", "Vercel", "Next.js"].map((tag) => (
            <div
              key={tag}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 999,
                padding: "10px 24px",
                fontSize: 22,
                color: "white",
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            fontSize: 22,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          flow-board-app-mu.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
