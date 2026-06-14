"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRaceRoom } from "@/hooks/useRaceRoom";
import { useTypingEngine } from "@/hooks/useTypingEngine";
import { TypingDisplay } from "@/components/practice/TypingDisplay";
import { TypingInput } from "@/components/practice/TypingInput";
import { StatsHud } from "@/components/practice/StatsHud";
import { PlayerCard } from "@/components/multiplayer/PlayerCard";
import { RacerProgressBars } from "@/components/multiplayer/RacerProgressBars";
import { CountdownOverlay } from "@/components/multiplayer/CountdownOverlay";
import { RaceFinishedScreen } from "@/components/multiplayer/RaceFinishedScreen";

interface RoomClientProps {
  code:     string;
  userId:   string;
  username: string;
  name:     string;
  image:    string | null;
}

export function RoomClient({ code, userId, username, name, image }: RoomClientProps) {
  const router   = useRouter();
  const sentFinish = useRef(false);

  const {
    phase, room, players, myPlayer, countdown,
    error, myRank, standings, isHost,
    startRace, sendProgress, sendFinished, leaveRoom,
  } = useRaceRoom({ code, userId, username, name, image });

  const passageText = room?.passageText ?? "";
  const engine      = useTypingEngine(passageText);

  // ── Send progress updates while racing ─────────────────────────────────
  useEffect(() => {
    if (phase !== "racing" || engine.status !== "racing") return;
    sendProgress(engine.stats.progress, engine.stats.wpm, engine.stats.accuracy);
  }, [phase, engine.stats.progress, engine.stats.wpm, engine.stats.accuracy, engine.status, sendProgress]);

  // ── Auto-start engine when race begins ─────────────────────────────────
  useEffect(() => {
    if (phase === "racing" && engine.status === "idle") {
      engine.startRace();
    }
  }, [phase, engine.status, engine.startRace]);

  // ── Send finish when typing complete ───────────────────────────────────
  useEffect(() => {
    if (engine.status !== "finished" || sentFinish.current) return;
    sentFinish.current = true;
    sendFinished({
      wpm:          engine.stats.wpm,
      rawWpm:       engine.stats.rawWpm,
      accuracy:     engine.stats.accuracy,
      timeTakenMs:  engine.stats.elapsedMs,
      keystrokeLog: engine.keystrokeLog as object[],
    }).catch(console.error);
  }, [engine.status, engine.stats.wpm, engine.stats.rawWpm, engine.stats.accuracy, engine.stats.elapsedMs, engine.keystrokeLog, sendFinished]);

  // ── Reset for rematch ────────────────────────────────────────────────
  function handleRematch() {
    sentFinish.current = false;
    engine.resetRace();
    router.push("/multiplayer/create");
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-ink mb-2">Can&apos;t join room</h2>
        <p className="text-ink-2 text-sm mb-6">{error || "Room not found or already started."}</p>
        <div className="flex gap-3 justify-center">
          <Link href="/multiplayer/join"   className="btn-ghost px-5 py-2.5">Try another code</Link>
          <Link href="/multiplayer/create" className="btn-primary px-5 py-2.5">Create room</Link>
        </div>
      </div>
    );
  }

  // ── Connecting ─────────────────────────────────────────────────────────
  if (phase === "connecting") {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <div className="w-6 h-6 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
        <span className="text-ink-2">Connecting to room {code}…</span>
      </div>
    );
  }

  // ── Finished ──────────────────────────────────────────────────────────
  if (phase === "finished") {
    return (
      <RaceFinishedScreen
        standings={standings}
        myUserId={userId}
        roomCode={code}
        onRematch={handleRematch}
      />
    );
  }

  // ── Countdown overlay ─────────────────────────────────────────────────
  const showCountdown = phase === "countdown";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {showCountdown && <CountdownOverlay countdownValue={countdown} />}

      {/* Room header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-mono text-ink">Room</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-lg font-bold text-brand-400 tracking-widest">{code}</span>
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/multiplayer/room/${code}`)}
              className="text-xs text-ink-3 hover:text-ink-2 transition-colors border border-surface-3
                         px-2 py-0.5 rounded"
            >
              Copy link
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
            phase === "racing"
              ? "bg-green-500/10 text-green-400 border-green-500/30"
              : phase === "countdown"
              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
              : "bg-surface-2 text-ink-3 border-surface-3"
          }`}>
            {phase === "lobby"     ? `Waiting · ${players.length}/${room?.maxPlayers ?? 4}`  : ""}
            {phase === "countdown" ? "Starting…" : ""}
            {phase === "racing"    ? "🏁 Racing" : ""}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">

        {/* Left: Players list */}
        <div className="space-y-2">
          <p className="text-xs text-ink-3 uppercase tracking-wider font-medium mb-2">Players</p>
          {players.map((p, i) => (
            <PlayerCard
              key={p.userId}
              player={p}
              index={i}
              isMe={p.userId === userId}
              isHost={p.userId === room?.hostId}
              status={phase}
            />
          ))}

          {/* Start button — host only, lobby only */}
          {phase === "lobby" && isHost && (
            <button
              onClick={startRace}
              disabled={players.length < 1}
              className="btn-primary w-full py-2.5 mt-2 text-sm"
            >
              Start race →
            </button>
          )}
          {phase === "lobby" && !isHost && (
            <p className="text-xs text-ink-3 text-center py-2">
              Waiting for host to start…
            </p>
          )}
        </div>

        {/* Right: Typing area */}
        <div className="md:col-span-2 space-y-4">
          {/* Progress bars (racing only) */}
          {phase === "racing" && (
            <div className="card p-4">
              <p className="text-xs text-ink-3 uppercase tracking-wider mb-3">Live positions</p>
              <RacerProgressBars players={players} myUserId={userId} />
            </div>
          )}

          {/* Stats HUD */}
          {(phase === "racing" || phase === "countdown") && (
            <StatsHud stats={engine.stats} status={engine.status} />
          )}

          {/* Typing display + input (racing only) */}
          {phase === "racing" && passageText && (
            <>
              <TypingDisplay
                chars={passageText.split("")}
                charStates={engine.charStates}
                cursorIndex={engine.cursorIndex}
              />
              <TypingInput
                value={engine.inputValue}
                status={engine.status}
                onChange={engine.handleInput}
                onStart={engine.startRace}
              />
            </>
          )}

          {/* Lobby waiting message */}
          {phase === "lobby" && (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-ink font-medium mb-1">Waiting in lobby</p>
              <p className="text-sm text-ink-2">
                {isHost
                  ? "Press Start race when everyone has joined."
                  : "The host will start the race shortly."}
              </p>
              <div className="mt-4 pt-4 border-t border-surface-3">
                <p className="text-xs text-ink-3">Share this link with friends:</p>
                <code className="text-xs text-brand-400 font-mono mt-1 block break-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/multiplayer/room/${code}`
                    : `/multiplayer/room/${code}`}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
