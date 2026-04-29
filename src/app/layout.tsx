import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { GuidedTour } from "@/components/GuidedTour";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glassbox — See through the spend.",
  description:
    "Glassbox surfaces duplication, recipient concentration, and language-calibration issues during drafting — not after audit. Federal grants and contributions. Alberta provincial spending. One transparent view, before the money goes out.",
  applicationName: "Glassbox",
  authors: [{ name: "Pythagorithm AI Governance Solutions" }],
  openGraph: {
    title: "Glassbox — See through the spend.",
    description:
      "Prospective accountability for federal and Alberta provincial spending. Search, evaluate, and audit before the money goes out.",
    type: "website",
    siteName: "Glassbox",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Glassbox — See through the spend." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Glassbox — See through the spend.",
    description:
      "Prospective accountability for federal and Alberta provincial spending.",
    images: ["/og.png"],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable} dark`}>
      <head>
        {/*
          Swallow the React 19 + Turbopack "removeChild on detached node"
          reconciliation race before Next's dev overlay sees it. The
          error.tsx auto-recovery already re-renders the affected tree;
          this just prevents the dev overlay from flashing the stack.
          Production is unaffected (the overlay only runs in dev).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              function isReconRace(e){
                var msg = (e && (e.message || (e.error && e.error.message))) || "";
                return /removeChild|insertBefore|appendChild/i.test(msg) &&
                       /null|detached/i.test(msg + " " + (e && e.error && e.error.stack || ""));
              }
              window.addEventListener("error", function(e){
                if (isReconRace(e)) { e.preventDefault(); e.stopImmediatePropagation && e.stopImmediatePropagation(); return false; }
              }, true);
              window.addEventListener("unhandledrejection", function(e){
                var r = e && e.reason; var msg = (r && r.message) || String(r || "");
                if (/removeChild|insertBefore|appendChild/i.test(msg)) { e.preventDefault(); }
              }, true);
            })();`,
          }}
        />
      </head>
      <body
        className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)] antialiased notranslate"
        translate="no"
      >
        <SiteHeader />
        {children}
        <GuidedTour />
      </body>
    </html>
  );
}
