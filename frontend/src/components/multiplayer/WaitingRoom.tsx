"use client";

import Image from "next/image";
import type { Player, RaceRoom } from "@/types/race";

interface WaitingRoomProps {
  room:      RaceRoom;
  players:   Player[];
  myUserId:  string;
  isHost:    boolean;
  onStart:   () => void;
  onCopy:    () => void;
  copied:    boolean;
}

const PLAYER_COLORS = ["#E8593C","#4A8FDD","#1D9E75","#9B7FE8"];

export function WaitingRoom({
  room, players, myUserId, isHost, onStart, onCopy, copied
}: WaitingRoomProps) {
  const roomUrl = typeof window !== "undefined"
    ? `${window.location.origin}/multiplayer/room/${room.code}`
    : `/multiplayer/room/${room.code}`;

  return (
    <div className="max-w-xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🏁</div>
        <h1 className="text-2xl font-bold font-mono text-ink mb-1">Waiting for players</h1>
        <p className="text-ink-2 text-sm">Share the code and race when ready</p>
      </div>

      {/* Room code card */}
      <div className="card p-6 mb-4 text-center">
        <p className="text-xs text-ink-3 uppercase tracking-widest mb-2">Room code</p>
        <div className="font-mono text-5xl font-bold text-brand-400 tracking-[.2em] mb-4">
          {room.code}
        </div>
        <button
          onClick={onCopy}
          className="btn-ghost text-sm px-5 py-2 w-full"
        >
          {copied ? "✓ Link copied!" : "📋 Copy invite link"}
        </button>
        <p className="text-xs text-ink-3 mt-3 break-all">{roomUrl}</p>
      </div>

      {/* Players list */}
      <div className="card overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-surface-3 flex items-center justify-between">
          <p className="text-xs text-ink-3 uppercase tracking-wider font-medium">Players</p>
          <p className="text-xs text-ink-3">{players.length} / {room.maxPlayers}</p>
        </div>

        {/* Filled slots */}
        {players.map((p, i) => (
          <div key={p.userId}
            className="flex items-center gap-3 px-5 py-4 border-b border-surface-3 last:border-0">
            {/* Color dot */}
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />

            {/* Avatar */}
            {p.image ? (
              <Image src={p.image} alt={p.name} width={36} height={36} className="rounded-full" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: PLAYER_COLORS[i % PLAYER_COLORS.length] + "22",
                  color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                {p.userId === myUserId && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: PLAYER_COLORS[i % PLAYER_COLORS.length] + "22",
                      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                    }}>you</span>
                )}
                {p.userId === room.hostId && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded
                                   bg-yellow-500/10 text-yellow-400">host</span>
                )}
              </div>
              <p className="text-xs text-ink-3">@{p.username}</p>
            </div>

            {/* Ready indicator */}
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0
                            animate-pulse" />
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: room.maxPlayers - players.length }).map((_, i) => (
          <div key={`empty-${i}`}
            className="flex items-center gap-3 px-5 py-4 border-b border-surface-3 last:border-0">
            <div className="w-2.5 h-2.5 rounded-full bg-surface-3 flex-shrink-0" />
            <div className="w-9 h-9 rounded-full border-2 border-dashed border-surface-4
                            flex items-center justify-center">
              <span className="text-ink-3 text-sm">+</span>
            </div>
            <span className="text-sm text-ink-3">Waiting for player…</span>
          </div>
        ))}
      </div>

      {/* Start button */}
      {isHost ? (
        <button
          onClick={onStart}
          disabled={players.length < 1}
          className="btn-primary w-full py-4 text-base font-semibold"
        >
          Start race ({players.length} player{players.length !== 1 ? "s" : ""}) →
        </button>
      ) : (
        <div className="card px-5 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            <p className="text-sm text-ink-2">Waiting for host to start the race…</p>
          </div>
        </div>
      )}
    </div>
  );
}
