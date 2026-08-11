"use client";
import { useState } from "react";
import { useLocale } from "./LocaleProvider";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const { locale, t } = useLocale();
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      window.localStorage.removeItem("mb_last_production");
      window.location.assign("/studio");
    } finally { setBusy(false); }
  }
  return <button className="link nav-signout" type="button" onClick={logout} disabled={busy}>{busy ? (locale === "ar" ? "جارٍ الخروج…" : "Signing out…") : t("signOut")}</button>;
}
