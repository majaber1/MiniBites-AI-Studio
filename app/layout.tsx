import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniBites AI Studio",
  description: "Agent-driven production studio for real miniature-cooking shorts.",
};
export const viewport: Viewport = { themeColor: "#171412" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400..700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="nav">
          <div className="wrap nav-inner">
            <Link href="/" className="brand">
              MiniBites<small>AI STUDIO</small>
            </Link>
            <Link className="link" href="/studio">Creator Studio</Link>
            <Link className="link" href="/agents">Agents</Link>
            <Link className="link" href="/library">Library</Link>
            <Link className="link" href="/integrations">Integrations</Link>
          </div>
        </nav>
        {children}
        <footer>
          <div className="wrap">
            MiniBites AI Studio · real productions only — no simulated progress, no publishing without platform confirmation.
          </div>
        </footer>
      </body>
    </html>
  );
}
