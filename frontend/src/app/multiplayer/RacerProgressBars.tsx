"use client";

import Image from "next/image";
import type { Player } from "@/types/race";

const COLORS = ["#E8593C","#4A8FDD","#1D9E75","#9B7FE8"];

interface RacerProgressBarsProps {
  players: Player[];
  myUserId: string;
}

export function RacerProgressBars({ players, myUserId }: RacerProgressBarsProps) {
  const sorted = [...players].sort((a, b) => b.progress - a.progress);

  return (
    <div className="space-y-3">
      {sorted.map((player, i) => {
        const color = COLORS[i % COLORS.length];
        const isMe  = player.userId === myUserId;

        return (
          <div key={player.userId} className="flex items-center gap-3">
            {/* Rank position */}
            <div className="w-5 flex-shrink-0 text-center">
              <span className="font-mono text-xs text-ink-3">{i + 1}</span>
            </div>

            {/* Avatar */}
            {player.image ? (
              <Image src={player.image} alt={player.name} width={28} height={28}
                className="rounded-full flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center
                              text-xs font-bold flex-shrink-0"
                style={{ background: color + "22", color }}>
                {player.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Name */}
            <span className={`text-xs font-medium w-20 truncate flex-shrink-0 ${isMe ? "text-brand-400" : "text-ink-2"}`}>
              {isMe ? "you" : player.username}
            </span>

            {/* Progress bar */}
            <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${player.progress}%`, background: color }}
              />
            </div>

            {/* WPM */}
            <span className="font-mono text-xs text-ink-2 w-14 text-right flex-shrink-0">
              {player.finished
                ? <span style={{ color }} className="font-bold">✓ {player.wpm}</span>
                : `${player.wpm} wpm`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
