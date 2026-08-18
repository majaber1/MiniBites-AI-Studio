import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Sans_Arabic } from "next/font/google";
import AppShell from "@/components/AppShell";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";
import "./creator.css";
import "./kiswani.css";

export const metadata: Metadata = {
  title: "Kiswani AI Studio — Create, publish, learn",
  description: "AI production studio for recurring series, campaigns and short-form video projects.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { themeColor: "#fffaf5" };

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${geist.variable} ${arabic.variable}`}>
        <LocaleProvider><AppShell>{children}</AppShell></LocaleProvider>
      </body>
    </html>
  );
}
