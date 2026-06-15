"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRaceRoom } from "@/hooks/useRaceRoom";
import { useTypingEngine } from "@/hooks/useTypingEngine";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { CountdownOverlay } from "@/components/multiplayer/CountdownOverlay";
import { RaceHUD } from "@/components/multiplayer/RaceHUD";
import { LiveProgressBars } from "@/components/multiplayer/LiveProgressBars";
import { FinishScreen } from "@/components/multiplayer/FinishScreen";
import { TypingDisplay } from "@/components/practice/TypingDisplay";
import { TypingInput } from "@/components/practice/TypingInput";

interface RoomClientProps {
  code:     string;
  userId:   string;
  username: string;
  name:     string;
  image:    string | null;
}

export function RoomClient({ code, userId, username, name, image }: RoomClientProps) {
  const router     = useRouter();
  const sentFinish = useRef(false);
  const [copied,   setCopied]   = useState(false);
  const [myRank,   setMyRank]   = useState<number | null>(null);

  const {
    phase, room, players, countdown,
    error, standings, isHost,
    startRace, sendProgress, sendFinished, leaveRoom,
  } = useRaceRoom({ code, userId, username, name, image });

  const passageText = room?.passageText ?? "";
  const engine      = useTypingEngine(passageText);

  // Auto-start typing engine when race begins
  useEffect(() => {
    if (phase === "racing" && engine.status === "idle") {
      engine.startRace();
    }
  }, [phase]);

  // Throttled progress updates — every 250ms max
  const lastSent = useRef(0);
  useEffect(() => {
    if (phase !== "racing" || engine.status !== "racing") return;
    const now = Date.now();
    if (now - lastSent.current < 250) return;
    lastSent.current = now;
    sendProgress(engine.stats.progress, engine.stats.wpm, engine.stats.accuracy);
  }, [engine.stats.progress]);

  // Send finish when typing complete
  useEffect(() => {
    if (engine.status !== "finished" || sentFinish.current) return;
    sentFinish.current = true;
    sendFinished({
      wpm:          engine.stats.wpm,
      rawWpm:       engine.stats.rawWpm,
      accuracy:     engine.stats.accuracy,
      timeTakenMs:  engine.stats.elapsedMs,
      keystrokeLog: engine.keystrokeLog as object[],
    })
      .then(({ rank }) => setMyRank(rank))
      .catch(console.error);
  }, [engine.status]);

  // Copy room link
  function handleCopy() {
    const url = `${window.location.origin}/multiplayer/room/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Rematch — go back to create
  function handleRematch() {
    sentFinish.current = false;
    engine.resetRace();
    router.push("/multiplayer/create");
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-ink mb-2">Can't join room</h2>
        <p className="text-sm text-ink-2 mb-6">{error || "Room not found or already in progress."}</p>
        <div className="flex gap-3 justify-center">
          <Link href="/multiplayer/join"   className="btn-ghost px-5 py-2.5">Try another code</Link>
          <Link href="/multiplayer/create" className="btn-primary px-5 py-2.5">Create room</Link>
        </div>
      </div>
    );
  }

  // ── Connecting ────────────────────────────────────────────────────────────
  if (phase === "connecting") {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <div className="w-6 h-6 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
        <span className="text-ink-2 font-medium">Connecting to room <span className="font-mono text-brand-400">{code}</span>…</span>
      </div>
    );
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <WaitingRoom
        room={room!}
        players={players}
        myUserId={userId}
        isHost={isHost}
        onStart={startRace}
        onCopy={handleCopy}
        copied={copied}
      />
    );
  }

  // ── Finished ──────────────────────────────────────────────────────────────
  if (phase === "finished") {
    return (
      <FinishScreen
        standings={standings}
        myUserId={userId}
        roomCode={code}
        onRematch={handleRematch}
      />
    );
  }

  // ── Racing (+ countdown overlay) ─────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Countdown overlay */}
      {phase === "countdown" && <CountdownOverlay value={countdown} />}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-brand-400 tracking-wider">{code}</span>
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-500/10
                           text-green-400 border border-green-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Racing
          </span>
        </div>
        <span className="text-xs text-ink-3">{players.length} racer{players.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Stats HUD */}
      <div className="mb-4">
        <RaceHUD
          stats={engine.stats}
          status={engine.status}
          myRank={myRank}
          players={players.length}
        />
      </div>

      {/* Live progress bars */}
      <div className="card p-4 mb-4">
        <p className="text-xs text-ink-3 uppercase tracking-wider mb-3 font-medium">Live positions</p>
        <LiveProgressBars players={players} myUserId={userId} />
      </div>

      {/* Typing area */}
      {passageText && (
        <>
          <TypingDisplay
            chars={passageText.split("")}
            charStates={engine.charStates}
            cursorIndex={engine.cursorIndex}
          />
          <div className="mt-3">
            <TypingInput
              value={engine.inputValue}
              status={engine.status}
              onChange={engine.handleInput}
              onStart={engine.startRace}
            />
          </div>
        </>
      )}

      {/* Already finished — waiting for others */}
      {engine.status === "finished" && phase === "racing" && (
        <div className="mt-4 card px-5 py-4 text-center">
          <div className="text-xl mb-1">
            {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🏁"}
          </div>
          <p className="text-sm font-medium text-ink">
            {myRank ? `You finished #${myRank}!` : "You finished!"} Waiting for others…
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
