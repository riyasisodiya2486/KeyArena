"use client";

import { formatTime } from "@/lib/wpm";
import type { TypingStats, EngineStatus } from "@/hooks/useTypingEngine";

interface RaceHUDProps {
  stats:    TypingStats;
  status:   EngineStatus;
  myRank:   number | null;
  players:  number;
}

export function RaceHUD({ stats, status, myRank, players }: RaceHUDProps) {
  const items = [
    {
      label: "WPM",
      value: status === "idle" ? "—" : stats.wpm.toString(),
      sub:   status === "racing" ? `raw ${stats.rawWpm}` : "net",
      color: stats.wpm >= 80 ? "text-brand-400" : "text-ink",
    },
    {
      label: "Accuracy",
      value: status === "idle" ? "—" : `${stats.accuracy}%`,
      sub:   stats.errorsCount > 0 ? `${stats.errorsCount} errors` : "perfect",
      color: stats.accuracy >= 98 ? "text-green-400" : stats.accuracy >= 90 ? "text-ink" : "text-red-400",
    },
    {
      label: "Progress",
      value: status === "idle" ? "—" : `${stats.progress}%`,
      sub:   `${stats.charsTyped} chars`,
      color: "text-ink",
    },
    {
      label: "Time",
      value: status === "idle" ? "—" : formatTime(stats.elapsedMs),
      sub:   undefined,
      color: "text-ink",
    },
    {
      label: "Rank",
      value: myRank ? `#${myRank}` : "—",
      sub:   `of ${players}`,
      color: myRank === 1 ? "text-brand-400" : "text-ink",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map((item) => (
        <div key={item.label} className="bg-surface-1 border border-surface-3 rounded-xl p-3 text-center">
          <div className="text-xs text-ink-3 uppercase tracking-wider mb-1">{item.label}</div>
          <div className={`font-mono text-xl font-bold leading-none ${item.color}`}>{item.value}</div>
          {item.sub && <div className="text-[10px] text-ink-3 mt-1">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
