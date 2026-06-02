"use client";

import { clsx } from "clsx";

export type Difficulty = "easy" | "medium" | "hard" | "code";

const DIFFICULTIES: { value: Difficulty; label: string; desc: string; color: string }[] = [
  { value: "easy",   label: "Easy",   desc: "Simple words, no punctuation", color: "text-green-400 border-green-500/30 bg-green-500/5" },
  { value: "medium", label: "Medium", desc: "Mixed vocabulary, some punctuation", color: "text-blue-400 border-blue-500/30 bg-blue-500/5" },
  { value: "hard",   label: "Hard",   desc: "Complex words, full punctuation", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5" },
  { value: "code",   label: "Code",   desc: "Real code snippets", color: "text-purple-400 border-purple-500/30 bg-purple-500/5" },
];

interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  disabled?: boolean;
}

export function DifficultySelector({ value, onChange, disabled }: DifficultySelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {DIFFICULTIES.map((d) => (
        <button
          key={d.value}
          disabled={disabled}
          onClick={() => onChange(d.value)}
          title={d.desc}
          className={clsx(
            "px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            value === d.value
              ? d.color
              : "text-ink-3 border-surface-3 bg-transparent hover:bg-surface-2 hover:text-ink-2"
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}