"use client";
import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      window.localStorage.removeItem("mb_last_production");
      window.location.assign("/studio");
    } finally { setBusy(false); }
  }
  return <button className="link nav-signout" type="button" onClick={logout} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>;
}
