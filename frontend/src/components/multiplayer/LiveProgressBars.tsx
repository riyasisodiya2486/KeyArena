"use client";

import Image from "next/image";
import type { Player } from "@/types/race";

const COLORS = ["#E8593C","#4A8FDD","#1D9E75","#9B7FE8"];

interface LiveProgressBarsProps {
  players:  Player[];
  myUserId: string;
}

export function LiveProgressBars({ players, myUserId }: LiveProgressBarsProps) {
  // Sort: finished players by rank, then unfinished by progress desc
  const sorted = [...players].sort((a, b) => {
    if (a.finished && b.finished) return (a.rank ?? 99) - (b.rank ?? 99);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });

  return (
    <div className="space-y-2.5">
      {sorted.map((player, i) => {
        const color = COLORS[i % COLORS.length];
        const isMe  = player.userId === myUserId;

        return (
          <div key={player.userId} className="flex items-center gap-2.5">
            {/* Position number */}
            <div className="w-4 text-center flex-shrink-0">
              <span className="font-mono text-xs text-ink-3">{i + 1}</span>
            </div>

            {/* Avatar */}
            <div className="flex-shrink-0">
              {player.image ? (
                <Image src={player.image} alt={player.name} width={26} height={26}
                  className="rounded-full" />
              ) : (
                <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center
                                text-[10px] font-bold"
                  style={{ background: color + "22", color }}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name */}
            <span className={`text-xs font-medium w-16 truncate flex-shrink-0 ${
              isMe ? "text-brand-400" : "text-ink-2"
            }`}>
              {isMe ? "you" : player.username}
            </span>

            {/* Progress track */}
            <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${player.progress}%`, background: color }}
              />
            </div>

            {/* WPM / Rank */}
            <div className="w-16 text-right flex-shrink-0">
              {player.finished ? (
                <span className="font-mono text-xs font-bold" style={{ color }}>
                  #{player.rank} · {player.wpm}
                </span>
              ) : (
                <span className="font-mono text-xs text-ink-2">{player.wpm} wpm</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
