import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import "./globals.css";
import "./creator.css";

export const metadata: Metadata = {
  title: "MiniBites Studio — Tiny food, big stories",
  description: "Agent-driven production studio for real miniature-cooking shorts.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { themeColor: "#fffaf5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="nav">
          <div className="wrap nav-inner">
            <Link href="/" className="brand">
              <Image src="/logo-icon.svg" alt="" width={34} height={34} priority /> MiniBites
            </Link>
            <Link className="link" href="/dashboard">Dashboard</Link>
            <Link className="link" href="/studio">Creator Studio</Link>
            <Link className="link" href="/library">Library</Link>
            <Link className="link" href="/templates">Templates</Link>
            <Link className="link" href="/integrations">Integrations</Link>
            <LogoutButton />
            <Link className="nav-cta" href="/studio">Create</Link>
          </div>
        </nav>
        {children}
        <footer>
          <div className="wrap">
            MiniBites V3 · Real production status. Human approval before every publish.
          </div>
        </footer>
      </body>
    </html>
  );
}
