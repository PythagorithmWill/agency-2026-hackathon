import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Glassbox — See through the spend." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Glassbox — See through the spend.",
    description:
      "Prospective accountability for federal and Alberta provincial spending.",
    images: ["/og.svg"],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable} dark`}>
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)] antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
