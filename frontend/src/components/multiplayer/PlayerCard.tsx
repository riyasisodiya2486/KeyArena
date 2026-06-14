"use client";

import Image from "next/image";
import type { Player } from "@/types/race";

const PLAYER_COLORS = [
  { bar: "#E8593C", bg: "#2B1308", border: "#E8593C44" },
  { bar: "#4A8FDD", bg: "#0D2137", border: "#4A8FDD44" },
  { bar: "#1D9E75", bg: "#0D3326", border: "#1D9E7544" },
  { bar: "#9B7FE8", bg: "#1E1530", border: "#9B7FE844" },
];

interface PlayerCardProps {
  player:  Player;
  index:   number;
  isMe:    boolean;
  isHost:  boolean;
  status:  string;
}

export function PlayerCard({ player, index, isMe, isHost, status }: PlayerCardProps) {
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border transition-all"
      style={{
        background: isMe ? color.bg : "#161618",
        borderColor: isMe ? color.border : "#26262A",
      }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {player.image ? (
          <Image src={player.image} alt={player.name} width={36} height={36} className="rounded-full" />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: color.bg, color: color.bar, border: `1.5px solid ${color.bar}44` }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
        )}
        {player.finished && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full
                          flex items-center justify-center text-[9px] text-white font-bold">
            ✓
          </div>
        )}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-ink truncate">{player.name}</span>
          {isMe   && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: color.bg, color: color.bar }}>you</span>}
          {isHost && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-500/10 text-yellow-400">host</span>}
        </div>
        <p className="text-xs text-ink-3">@{player.username}</p>
      </div>

      {/* Stats or rank */}
      {status === "racing" && !player.finished && (
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-sm font-bold text-ink">{player.wpm}</p>
          <p className="text-xs text-ink-3">wpm</p>
        </div>
      )}
      {player.finished && player.rank && (
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-lg font-bold" style={{ color: color.bar }}>#{player.rank}</p>
          <p className="font-mono text-xs text-ink-3">{player.wpm} wpm</p>
        </div>
      )}
    </div>
  );
}
