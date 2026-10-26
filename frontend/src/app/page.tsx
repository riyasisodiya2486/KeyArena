import Link from "next/link";
import type { ReactNode } from "react";
import { TypingDemo } from "./home/TypingDemo";
import { Navbar } from "@/components/layout/Navbar";

const ranks = [
  ["01", "neo_type", "142", "99.2%", "+2"],
  ["02", "mira.keys", "138", "98.7%", "−1"],
  ["03", "swiftline", "131", "98.4%", "+4"],
  ["04", "byte.runner", "127", "97.9%", "—"],
  ["05", "you_next", "—", "—", "ENTER →"],
];

function FeatureLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="ka-arrow-link">{children}<span aria-hidden="true">↗</span></Link>;
}

export default function Home() {
  return <main className="ka-home">
    <Navbar />

    <section className="ka-hero">
      <div className="ka-hero-copy"><p className="ka-kicker"><span>01 / KEYARENA</span><span>THE COMPETITIVE TYPING CLUB</span></p>
        <h1>Every<br /><span>keystroke</span><br />counts<span className="ka-period">.</span></h1>
        <p className="ka-lede">Practice your precision. Challenge your limits. Race the world, one character at a time.</p>
        <div className="ka-actions"><Link href="/practice" className="ka-button">Find your typing zone <span>↗</span></Link><Link href="/leaderboard" className="ka-text-link">Explore the rankings <span>↓</span></Link></div>
      </div>
      <div className="ka-hero-art"><div className="ka-orbit ka-orbit-one"/><div className="ka-orbit ka-orbit-two"/><div className="ka-hero-stamp"><span>TYPE</span><b>FAST<br />STAY<br />SHARP</b><small>KEYARENA / 001</small></div><TypingDemo/><div className="ka-side-note">PRECISION<br />IS A PRACTICE <span>✳</span></div></div>
      <div className="ka-hero-foot"><span>SCROLL TO EXPLORE</span><span>01 — 05</span><span>BUILT FOR THE NEXT PERSONAL BEST</span></div>
    </section>

    <section className="ka-manifesto"><div className="ka-section-index">A BETTER KIND OF PRACTICE <span>✳</span></div><p>Not just words per minute.<br /><span>A rhythm worth chasing.</span></p><div className="ka-manifesto-bottom"><span>Practice makes pace.<br />Competition makes it count.</span><Link href="/practice">START WITH A WARM-UP ↗</Link></div></section>

    <section className="ka-arenas" id="arenas"><div className="ka-section-head"><div><p className="ka-kicker">02 / PICK YOUR PACE</p><h2>Choose your<br /><i>arena.</i></h2></div><p>Warm up alone, challenge your friends, or compete for a place at the top.</p></div>
      <div className="ka-feature-grid">
        <article className="ka-feature ka-practice"><div className="ka-feature-meta"><span>01 / SOLO PRACTICE</span><span>YOUR PACE, YOUR RULES</span></div><div className="ka-mini-typing"><span className="typed">Precision comes</span><span className="cursor"> with practice.</span><small>THE RHYTHM IS YOURS</small></div><div className="ka-feature-bottom"><div><h3>Find your<br />flow state.</h3><p>Build speed without sacrificing precision.</p></div><FeatureLink href="/practice">Open typing zones</FeatureLink></div><div className="ka-difficulty">PICK A LEVEL <Link href="/practice?difficulty=easy">EASY</Link><Link href="/practice?difficulty=medium">MEDIUM</Link><Link href="/practice?difficulty=hard">HARD</Link><Link href="/practice?difficulty=code">CODE</Link></div></article>
        <article className="ka-feature ka-multiplayer"><div className="ka-feature-meta"><span>02 / MULTIPLAYER</span><span>UP TO 4 RACERS</span></div><div className="ka-race-visual"><div className="ka-race-label">ILLUSTRATIVE RACE PREVIEW</div><div className="ka-racer"><b>YOU</b><i style={{width:"76%"}}/><span>76%</span></div><div className="ka-racer"><b>RIVAL_02</b><i style={{width:"61%"}}/><span>61%</span></div><div className="ka-racer"><b>RIVAL_03</b><i style={{width:"48%"}}/><span>48%</span></div><div className="ka-finish">FINISH</div></div><div className="ka-feature-bottom"><div><h3>Friends make<br />fast rivals.</h3><p>Create a room or enter a six-character code.</p></div><div className="ka-stack-links"><FeatureLink href="/multiplayer/create">Create a room</FeatureLink><FeatureLink href="/multiplayer/join">Join a room</FeatureLink></div></div></article>
        <article className="ka-feature ka-compete"><div className="ka-feature-meta"><span>03 / COMPETITIONS</span><span>RACE FORMAT</span></div><div className="ka-countdown"><span>FIND YOUR PLACE ON THE GRID</span><strong>TYPE<span> / </span>RACE</strong><small>CHECK THE COMPETITION PAGE FOR UPCOMING EVENTS</small></div><div className="ka-feature-bottom"><div><h3>One field.<br />One finish.</h3><p>Enter the competition and earn your rank.</p></div><FeatureLink href="/compete">Enter competition</FeatureLink></div></article>
        <article className="ka-feature ka-insights"><div className="ka-feature-meta"><span>04 / AI INSIGHTS</span><span>PERSONAL PROGRESS</span></div><div className="ka-signal"><div><span>th</span><i style={{height:"34%"}}/><small>0.34</small></div><div><span>er</span><i style={{height:"58%"}}/><small>0.58</small></div><div><span>ing</span><i style={{height:"82%"}}/><small>0.82</small></div><div><span>tion</span><i style={{height:"46%"}}/><small>0.46</small></div></div><div className="ka-feature-bottom"><div><h3>Turn slips<br />into strength.</h3><p>Spot the patterns that will make you better.</p></div><FeatureLink href="/insights">Explore insights</FeatureLink></div><small className="ka-footnote">YOUR PERSONAL ANALYSIS APPEARS AFTER A RACE</small></article>
      </div>
    </section>

    <section className="ka-method"><div className="ka-method-title"><p className="ka-kicker">03 / THE LOOP</p><h2>Practice.<br /><span>Race.</span><br />Improve.</h2><p>Every run gives you another way forward.</p></div><div className="ka-steps"><article><span>01 — PRACTICE</span><b>Build speed<br />with intention.</b><p>Settle in with a passage that meets you where you are.</p><FeatureLink href="/practice">Start a practice</FeatureLink></article><article><span>02 — RACE</span><b>Make every<br />second count.</b><p>Take on friends or step into the competition field.</p><FeatureLink href="/multiplayer">Find a race</FeatureLink></article><article><span>03 — IMPROVE</span><b>Know what<br />to work on.</b><p>Turn your race history into a smarter next session.</p><FeatureLink href="/insights">See your insights</FeatureLink></article></div></section>

    <section className="ka-leaderboard" id="rankings"><div className="ka-board-head"><div><p className="ka-kicker">04 / THE SCOREBOARD</p><h2>Make your<br /><i>name count.</i></h2></div><p>Every race changes the rankings.<br />Every keystroke gets you closer.</p></div><div className="ka-board-label"><span>GLOBAL / ALL-TIME</span><span>ILLUSTRATIVE PREVIEW</span></div><div className="ka-rank-table"><div className="ka-rank-row ka-rank-header"><span>RANK</span><span>RACER</span><span>WPM</span><span>ACCURACY</span><span>MOVE</span></div>{ranks.map((r) => <div key={r[0]} className={r[0] === "05" ? "ka-rank-row ka-you" : "ka-rank-row"}><span>{r[0]}</span><b>{r[1]}</b><span>{r[2]}</span><span>{r[3]}</span><span>{r[4]}</span></div>)}</div><div className="ka-board-foot"><span>RANKINGS ARE A PREVIEW — RACE TO EARN YOUR PLACE</span><FeatureLink href="/leaderboard">View all rankings</FeatureLink></div></section>

    <section className="ka-numbers"><div><b>01</b><span>FOCUS, ONE PASSAGE AT A TIME</span></div><div><b>∞</b><span>ROOM TO FIND YOUR RHYTHM</span></div><div><b>YOU</b><span>THE NEXT NAME ON THE BOARD</span></div></section>

    <section className="ka-final"><p className="ka-kicker">05 / YOUR MOVE</p><div className="ka-final-line"><h2>Your next personal<br /><i>best starts here.</i></h2><div className="ka-final-aside"><p>Find your rhythm. Sharpen your accuracy. Earn your place on the board.</p><Link href="/practice" className="ka-button ka-button-light">Start racing <span>↗</span></Link></div></div><div className="ka-final-type" aria-hidden="true">a s d f j k l ; <span>_</span></div></section>

    <footer className="ka-footer"><Link className="ka-wordmark" href="/"><span className="ka-mark">K<span>.</span></span>KeyArena</Link><span>MADE FOR THE LOVE OF THE NEXT LETTER.</span><div><Link href="/practice">Practice</Link><Link href="/multiplayer">Multiplayer</Link><Link href="/compete">Compete</Link><Link href="/leaderboard">Rankings</Link><Link href="/insights">Insights</Link></div><Link href="/auth/signin">SIGN IN ↗</Link></footer>
  </main>;
}
