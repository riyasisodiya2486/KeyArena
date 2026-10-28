"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { AppIcon } from "@/components/ui/AppIcon";

export default function CreateRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!session?.user) {
      router.push("/auth/signin?callbackUrl=/multiplayer/create");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create room"); return; }
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
      <main className="ka-room-page">
        <div className="ka-room-layout">
          <section className="ka-room-story">
            <p className="ka-room-kicker"><span /> LIVE MULTIPLAYER / 01</p>
            <h1>Make every<br /><em>keystroke</em><br />a race.</h1>
            <p className="ka-room-intro">Bring your people into the arena. Set the pace, share a code, and see who finishes first.</p>
            <div className="ka-room-preview" aria-hidden="true">
              <div className="ka-room-preview-head"><span>ROOM STATUS</span><span><i /> READY</span></div>
              <div className="ka-room-lanes">
                {["YOU", "RACER 02", "RACER 03"].map((racer, index) => <div className="ka-room-lane" key={racer}><span>{racer}</span><i style={{ "--lane-progress": `${index === 0 ? 72 : index === 1 ? 48 : 27}%` } as React.CSSProperties} /></div>)}
              </div>
              <div className="ka-room-preview-foot"><span>FIRST TO FINISH</span><strong>WINS <b>↗</b></strong></div>
            </div>
          </section>

          <section className="ka-room-card">
            <div className="ka-room-card-icon"><AppIcon name="rocket" size={21} /></div>
            <p className="ka-room-card-label">HOST A PRIVATE RACE</p>
            <h2>Create a room<span>.</span></h2>
            <p className="ka-room-card-copy">Your room, your racers. Create a private lobby and invite friends with a six-character code.</p>

            {!session?.user && status !== "loading" && <div className="ka-room-auth-note"><AppIcon name="users" size={16} /><span>Sign in is required to host. Your room code is ready to share once created.</span></div>}
            {error && <div role="alert" className="ka-room-error">{error}</div>}

            <div className="ka-room-specs">
              {[["01", "Players", "Up to 4 racers"], ["02", "Passage", "Random medium text"], ["03", "Format", "First to finish wins"]].map(([n, k, v]) => (
                <div key={k}><small>{n}</small><span>{k}</span><strong>{v}</strong></div>
              ))}
            </div>

            <button onClick={handleCreate} disabled={loading || status === "loading"} className="btn-primary ka-room-submit w-full py-3 flex items-center justify-center gap-2">
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating room...</> : session?.user ? <>Create private room <span>↗</span></> : <>Sign in to host <span>↗</span></>}
            </button>

            <div className="ka-room-alternate"><span>ALREADY HAVE A ROOM CODE?</span><Link href="/multiplayer/join">Join a room <span>↗</span></Link></div>
          </section>
        </div>
      </main>
    </>
  );
}
