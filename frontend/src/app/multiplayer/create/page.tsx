"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function CreateRoomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleCreate() {
    if (!session?.user) {
      router.push("/auth/signin?callbackUrl=/multiplayer/create");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/rooms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create room"); return; }
      // Redirect to lobby using socket-based room page
      router.push(`/multiplayer/room/${data.room.code}`);
    } catch {
      setError("Could not connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">⚡</div>
            <h1 className="text-2xl font-bold font-mono text-ink mb-2">Create a room</h1>
            <p className="text-ink-2 text-sm">Share the room code with friends to race together.</p>
          </div>

          <div className="card p-6 space-y-4">
            {!session?.user && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-yellow-400">
                You need to <Link href="/auth/signin" className="underline font-medium">sign in</Link> to create a room.
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="bg-surface-2 rounded-xl p-4 space-y-2">
              {[
                ["Players", "Up to 4 players"],
                ["Passage", "Random medium difficulty"],
                ["Mode",    "First to finish wins"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-ink-3">{k}</span>
                  <span className="text-ink font-medium">{v}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !session?.user}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating room…
                </>
              ) : "Create room →"}
            </button>

            <div className="text-center">
              <span className="text-ink-3 text-sm">Have a code?{" "}</span>
              <Link href="/multiplayer/join" className="text-brand-400 text-sm font-medium hover:underline">
                Join a room →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
