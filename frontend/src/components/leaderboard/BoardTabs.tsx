"use client";

import { clsx } from "clsx";
import type { BoardType } from "@/lib/redis";

const TABS: { value: BoardType; label: string; desc: string }[] = [
  { value: "alltime", label: "All time",  desc: "Best ever score" },
  { value: "weekly",  label: "This week", desc: "Resets Monday UTC" },
  { value: "daily",   label: "Today",     desc: "Resets midnight UTC" },
];

interface BoardTabsProps {
  value:    BoardType;
  onChange: (b: BoardType) => void;
}

export function BoardTabs({ value, onChange }: BoardTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          title={tab.desc}
          className={clsx(
            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            value === tab.value
              ? "bg-surface-1 text-ink shadow-sm"
              : "text-ink-3 hover:text-ink-2"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
