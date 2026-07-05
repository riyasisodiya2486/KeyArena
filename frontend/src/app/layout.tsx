// Replace your existing src/app/layout.tsx with this complete version
// Adds: SEO metadata, Open Graph, Twitter cards, canonical URLs

import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { SessionProvider } from "@/components/auth/SessionProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets:  ["latin"],
  variable: "--font-dm-sans",
  display:  "swap",
});

const spaceMono = Space_Mono({
  weight:   ["400", "700"],
  subsets:  ["latin"],
  variable: "--font-space-mono",
  display:  "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: {
    default:  "KeyArena — Competitive Typing Races",
    template: "%s · KeyArena",
  },
  description:
    "Race friends in real-time typing competitions. Track your WPM, climb the leaderboard, and get AI-powered insights to improve your speed.",
  keywords: ["typing", "typing race", "WPM", "typing speed", "competitive typing", "keyboard speed"],
  authors:  [{ name: "KeyArena" }],
  creator:  "KeyArena",
  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         "/",
    siteName:    "KeyArena",
    title:       "KeyArena — Competitive Typing Races",
    description: "Race friends in real-time. Track WPM, climb the leaderboard, get AI insights.",
    images: [{
      url:    "/og-image.png",
      width:  1200,
      height: 630,
      alt:    "KeyArena — Competitive Typing",
    }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "KeyArena — Competitive Typing Races",
    description: "Race friends in real-time. Track WPM, climb the leaderboard, get AI insights.",
    images:      ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon:    [{ url: "/favicon.ico" }, { url: "/icon-192.png", sizes: "192x192" }],
    apple:   [{ url: "/apple-touch-icon.png" }],
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor:     "#E8593C",
  colorScheme:    "dark",
  width:          "device-width",
  initialScale:   1,
  maximumScale:   1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en" className={`${dmSans.variable} ${spaceMono.variable} dark`}>
      <body className="font-sans antialiased">
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
