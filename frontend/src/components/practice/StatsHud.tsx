"use client";

import { formatTime } from "@/lib/wpm";
import type { TypingStats, EngineStatus } from "@/hooks/useTypingEngine";

interface StatsHudProps {
  stats: TypingStats;
  status: EngineStatus;
}

export function StatsHud({ stats, status }: StatsHudProps) {
  const items = [
    {
      label: "WPM",
      value: status === "idle" ? "—" : stats.wpm.toString(),
      sub: status === "racing" ? `raw ${stats.rawWpm}` : undefined,
      highlight: stats.wpm > 80,
    },
    {
      label: "Accuracy",
      value: status === "idle" ? "—" : `${stats.accuracy}%`,
      sub: stats.errorsCount > 0 ? `${stats.errorsCount} errors` : undefined,
      highlight: stats.accuracy >= 98,
    },
    {
      label: "Progress",
      value: status === "idle" ? "—" : `${stats.progress}%`,
      sub: `${stats.charsTyped} chars`,
      highlight: false,
    },
    {
      label: "Time",
      value: status === "idle" ? "—" : formatTime(stats.elapsedMs),
      sub: undefined,
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-surface-1 border border-surface-3 rounded-xl p-4"
        >
          <div className="text-xs text-ink-3 uppercase tracking-widest mb-1">
            {item.label}
          </div>
          <div
            className={`font-mono text-2xl font-bold leading-none ${
              item.highlight ? "text-brand-400" : "text-ink"
            }`}
          >
            {item.value}
          </div>
          {item.sub && (
            <div className="text-xs text-ink-3 mt-1">{item.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}