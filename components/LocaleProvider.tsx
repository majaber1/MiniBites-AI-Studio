"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "ar";

const messages = {
  en: {
    dashboard: "Dashboard", projects: "Projects", studio: "Create", library: "Library", publishing: "Publishing", monitoring: "Monitoring",
    backend: "Backend", templates: "Templates", integrations: "Integrations", agents: "AI Agents", operations: "Operations", create: "New episode",
    search: "Search projects", account: "Creator account", signOut: "Sign out", menu: "Open menu",
    close: "Close menu", collapse: "Collapse sidebar", expand: "Expand sidebar", home: "Home",
    workspace: "Workspace", system: "System", language: "العربية", skip: "Skip to content",
  },
  ar: {
    dashboard: "لوحة التحكم", projects: "المشاريع", studio: "إنشاء", library: "المكتبة", publishing: "النشر", monitoring: "المراقبة",
    backend: "وحدة التوجيه", templates: "القوالب", integrations: "التكاملات", agents: "وكلاء الذكاء", operations: "العمليات", create: "حلقة جديدة",
    search: "ابحث في المشاريع", account: "حساب المنشئ", signOut: "تسجيل الخروج", menu: "فتح القائمة",
    close: "إغلاق القائمة", collapse: "طي الشريط الجانبي", expand: "توسيع الشريط الجانبي", home: "الرئيسية",
    workspace: "مساحة العمل", system: "النظام", language: "English", skip: "انتقل إلى المحتوى",
  },
} as const;

type MessageKey = keyof typeof messages.en;
type LocaleValue = { locale: Locale; setLocale: (locale: Locale) => void; toggleLocale: () => void; t: (key: MessageKey) => string };
const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem("kiswani-locale", next);
    window.localStorage.setItem("minibites-locale", next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("kiswani-locale") ?? window.localStorage.getItem("minibites-locale");
    const preferred: Locale = saved === "ar" || saved === "en" ? saved : navigator.language.startsWith("ar") ? "ar" : "en";
    setLocale(preferred);
  }, [setLocale]);

  const value = useMemo<LocaleValue>(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === "ar" ? "en" : "ar"),
    t: (key) => messages[locale][key],
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
