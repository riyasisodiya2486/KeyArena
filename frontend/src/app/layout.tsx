import { DM_Sans, Space_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions);
  
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${spaceMono.variable} font-sans bg-surface text-ink antialiased`}>
        <SessionProvider session={session}>
          <div className="flex min-h-screen flex-col">
            {/* Nav sits at the top of the app viewport layout */}
            <Navbar />
            
            {/* The rest of your pages grow to fill the remaining screen real estate */}
            <main className="flex-1">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}