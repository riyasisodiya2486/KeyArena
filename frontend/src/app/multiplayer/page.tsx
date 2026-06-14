import { Navbar } from "@/components/layout/Navbar";
import Link from "next/link";

export const metadata = { title: "Multiplayer" };

export default function MultiplayerPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <h1 className="text-3xl font-bold font-mono text-ink mb-3">Multiplayer</h1>
          <p className="text-ink-2 mb-10">Race up to 4 friends in real-time. Share a code, type fast, win.</p>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/multiplayer/create"
              className="card p-6 hover:border-brand-400/40 hover:bg-surface-2 transition-all group text-left">
              <div className="text-3xl mb-3">⚡</div>
              <h2 className="font-semibold text-ink group-hover:text-brand-400 transition-colors mb-1">
                Create room
              </h2>
              <p className="text-xs text-ink-3">Host a race and invite friends</p>
            </Link>
            <Link href="/multiplayer/join"
              className="card p-6 hover:border-brand-400/40 hover:bg-surface-2 transition-all group text-left">
              <div className="text-3xl mb-3">🔗</div>
              <h2 className="font-semibold text-ink group-hover:text-brand-400 transition-colors mb-1">
                Join room
              </h2>
              <p className="text-xs text-ink-3">Enter a 6-character invite code</p>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
