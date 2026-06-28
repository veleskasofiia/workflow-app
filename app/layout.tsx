import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowBoard",
  description: "Your personal productivity dashboard — calendar, habits, budget tracker, and AI assistant in one place.",
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "FlowBoard — Your personal productivity dashboard",
    description: "Track your daily routines, habits, budget, and connect Gmail, Slack, Notion & more with an AI assistant.",
    url: "https://flow-board-app-mu.vercel.app",
    siteName: "FlowBoard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowBoard — Your personal productivity dashboard",
    description: "Track your daily routines, habits, budget, and connect Gmail, Slack, Notion & more with an AI assistant.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
