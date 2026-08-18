"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";
import { useLocale } from "./LocaleProvider";

type IconName = "grid" | "spark" | "film" | "layout" | "plug" | "bot" | "pulse" | "folder" | "send" | "chart";
const paths: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  spark: <><path d="m12 3-1.4 4.1a5 5 0 0 1-3.1 3.1L3.5 12l4 1.6a5 5 0 0 1 3 3L12 21l1.5-4.4a5 5 0 0 1 3-3l4-1.6-4-1.8a5 5 0 0 1-3.1-3.1Z"/></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
  plug: <><path d="m12 22 1-5-3-3 5-9 1 5 4 1-8 11Z"/></>,
  bot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/></>,
  pulse: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
  folder: <><path d="M3 7.5h7l2 2h9v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/></>,
};

function Icon({ name }: { name: IconName }) {
  return <svg className="shell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const navigation = [
  { href: "/dashboard", key: "dashboard", icon: "grid" },
  { href: "/projects", key: "projects", icon: "folder" },
  { href: "/studio", key: "studio", icon: "spark" },
  { href: "/library", key: "library", icon: "film" },
  { href: "/publishing", key: "publishing", icon: "send" },
  { href: "/monitoring", key: "monitoring", icon: "chart" },
  { href: "/templates", key: "templates", icon: "layout" },
  { href: "/integrations", key: "integrations", icon: "plug" },
  { href: "/agents", key: "agents", icon: "bot" },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, toggleLocale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  const current = navigation.find((item) => pathname.startsWith(item.href));
  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">{t("skip")}</a>
    {mobileOpen && <button className="shell-scrim" aria-label={t("close")} onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label={t("workspace")}>
      <div className="sidebar-brand">
        <Link href="/dashboard" className="brand"><Image src="/logo-icon.svg" alt="" width={34} height={34} priority/><span>Kiswani AI</span></Link>
        <button className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label={t("close")}>×</button>
      </div>
      <p className="sidebar-label">{t("workspace")}</p>
      <nav className="sidebar-nav">
        {navigation.map((item) => <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? "active" : ""} aria-current={pathname.startsWith(item.href) ? "page" : undefined} title={t(item.key)}><Icon name={item.icon}/><span>{t(item.key)}</span></Link>)}
      </nav>
      <div className="sidebar-bottom">
        <Link href="/operations" className={pathname.startsWith("/operations") ? "active" : ""}><Icon name="pulse"/><span>{t("operations")}</span></Link>
        <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? t("expand") : t("collapse")}><span aria-hidden="true">⇤</span><span>{t("collapse")}</span></button>
      </div>
    </aside>
    <div className="shell-column">
      <header className="topbar">
        <button className="icon-button mobile-only" onClick={() => setMobileOpen(true)} aria-label={t("menu")}>☰</button>
        <div className="breadcrumbs" aria-label="Breadcrumb"><Link href="/dashboard">{t("home")}</Link><span>/</span><strong>{current ? t(current.key) : t("home")}</strong></div>
        <div className="topbar-actions">
          <button className="language-toggle" onClick={toggleLocale} aria-label="Switch language">{t("language")}</button>
          <div className="account-chip"><span className="avatar">KS</span><span className="account-copy"><strong>{t("account")}</strong><LogoutButton /></span></div>
          <Link className="nav-cta" href="/studio">＋ <span>{t("create")}</span></Link>
        </div>
      </header>
      <div id="main-content" className="shell-content" tabIndex={-1}>{children}</div>
      <footer className="shell-footer">Kiswani AI Studio · {new Date().getFullYear()}</footer>
    </div>
  </div>;
}
