"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { AppIcon } from "@/components/ui/AppIcon";

export default function JoinRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <main className="ka-room-page ka-join-page">
        <div className="ka-room-layout">
          <section className="ka-room-story">
            <p className="ka-room-kicker"><span /> LIVE MULTIPLAYER / 02</p>
            <h1>Your next<br />race is<br /><em>one code away.</em></h1>
            <p className="ka-room-intro">Drop into a friend&apos;s lobby and turn a few minutes into a full-on race.</p>
            <div className="ka-join-steps">
              <div><small>01</small><span>Get the six-character code from your host.</span></div>
              <div><small>02</small><span>Enter it here to open the waiting room.</span></div>
              <div><small>03</small><span>Ready up and race when the host starts.</span></div>
            </div>
          </section>

          <section className="ka-room-card ka-join-card">
            <div className="ka-room-card-icon"><AppIcon name="link" size={21} /></div>
            <p className="ka-room-card-label">ENTER THE ARENA</p>
            <h2>Join a room<span>.</span></h2>
            <p className="ka-room-card-copy">Enter the code your friend shared. We&apos;ll take you straight to the lobby.</p>

            {!session?.user && status !== "loading" && <div className="ka-room-auth-note"><AppIcon name="users" size={16} /><span>Sign in is required to join a race. You can still enter your room code now.</span></div>}

            <form onSubmit={handleJoin}>
              <label htmlFor="room-code" className="ka-room-card-label ka-code-label">SIX-CHARACTER ROOM CODE</label>
              <div className={`ka-code-field ${error ? "has-error" : ""}`}>
                <input id="room-code" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()); setError(""); }} placeholder="ABC123" maxLength={6} autoComplete="off" autoCapitalize="characters" aria-describedby={error ? "room-code-error" : "room-code-help"} />
                <span>{String(code.length).padStart(2, "0")} / 06</span>
              </div>
              {error ? <p id="room-code-error" role="alert" className="ka-room-error">{error}</p> : <p id="room-code-help" className="ka-code-help">Letters and numbers, just as your host shared them.</p>}
              <button type="submit" disabled={loading || status === "loading" || (Boolean(session?.user) && code.trim().length < 6)} className="btn-primary ka-room-submit w-full py-3 flex items-center justify-center gap-2">
                {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Opening room...</> : session?.user ? <>Enter waiting room <span>↗</span></> : <>Sign in to join <span>↗</span></>}
              </button>
            </form>
            <div className="ka-room-alternate"><span>NO CODE YET?</span><Link href="/multiplayer/create">Host a room <span>↗</span></Link></div>
          </section>
        </div>
      </main>
    </>
  );
}
