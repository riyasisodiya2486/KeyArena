"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function JoinRoomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user) {
      router.push("/auth/signin?callbackUrl=/multiplayer/join");
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Room code must be 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    router.push(`/multiplayer/room/${trimmed}`);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🔗</div>
            <h1 className="text-2xl font-bold font-mono text-ink mb-2">Join a room</h1>
            <p className="text-ink-2 text-sm">Enter the 6-character room code from your friend.</p>
          </div>

          <div className="card p-6">
            {!session?.user && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-yellow-400 mb-4">
                You need to <Link href="/auth/signin" className="underline font-medium">sign in</Link> to join a room.
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs text-ink-3 uppercase tracking-wider mb-2">
                  Room code
                </label>
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                  placeholder="ABC123"
                  maxLength={6}
                  className="input w-full text-center font-mono text-2xl tracking-[.3em] py-4 uppercase"
                  autoFocus
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.trim().length < 6 || !session?.user}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining…
                  </>
                ) : "Join room →"}
              </button>

              <div className="text-center">
                <span className="text-ink-3 text-sm">Want to host?{" "}</span>
                <Link href="/multiplayer/create" className="text-brand-400 text-sm font-medium hover:underline">
                  Create a room →
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
