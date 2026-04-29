import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency 2026 — Pythagorithm",
  description:
    "Three accountability surfaces — Glass Box, Outcome Brief, Counterfactual Brief — for the Government of Alberta Agency 2026 hackathon.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Three faces: General Sans (body), Fraunces (display), JetBrains Mono (data).
            Hosted: Fraunces + JetBrains Mono on Google Fonts; General Sans on Fontshare. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--color-ink)] text-[var(--color-paper)]">
        {children}
      </body>
    </html>
  );
}
