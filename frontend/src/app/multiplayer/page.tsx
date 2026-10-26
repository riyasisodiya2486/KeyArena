import { Navbar } from "@/components/layout/Navbar";
import Link from "next/link";
import { ArrowUpRight, Users, Plus, DoorOpen } from "lucide-react";

export const metadata = { title: "Multiplayer" };

export default function MultiplayerPage() {
  return (
    <>
      <Navbar />
      <main className="ka-route-page min-h-screen">
        <div className="ka-route-shell">
          <header className="ka-route-hero">
            <p className="ka-route-kicker">KEYARENA / LIVE ROOMS</p>
            <h1>Race your<br /><em>people.</em></h1>
            <p>Create a private room, share its code, and race up to four players in real time.</p>
          </header>
          <div className="ka-action-grid">
            <Link href="/multiplayer/create" className="ka-action-card">
              <span className="ka-action-icon"><Plus size={19} /></span>
              <small>01 / HOST</small><h2>Create a room</h2>
              <p>Signed-in racers can host a room and choose the race setup.</p>
              <span className="ka-card-link">Create room <ArrowUpRight size={15} /></span>
            </Link>
            <Link href="/multiplayer/join" className="ka-action-card">
              <span className="ka-action-icon"><DoorOpen size={19} /></span>
              <small>02 / JOIN</small><h2>Enter a room</h2>
              <p>Have an invite code? Join a friend and take your place at the starting line.</p>
              <span className="ka-card-link">Join with code <ArrowUpRight size={15} /></span>
            </Link>
          </div>
          <div className="ka-host-note"><Users size={17} /><span><strong>Private room hosting is open to every signed-in user.</strong> Official site-wide competitions are scheduled by KeyArena admins.</span></div>
        </div>
      </main>
    </>
  );
}
