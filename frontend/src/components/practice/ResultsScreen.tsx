"use client";

import { formatTime, calcConsistency, getTopBigramErrors } from "@/lib/wpm";
import type { TypingStats } from "@/hooks/useTypingEngine";
import type { KeystrokeEvent } from "@/lib/db/schema";
import type { Difficulty } from "@/components/practice/DifficultySelector";

interface ResultsProps {
  stats: TypingStats;
  keystrokeLog: KeystrokeEvent[];
  difficulty: Difficulty;
  onRetry: () => void;
  onNext: () => void;
  saving?: boolean;
}

function wpmGrade(wpm: number): { label: string; color: string } {
  if (wpm >= 130) return { label: "Legendary 🔥",  color: "text-red-400" };
  if (wpm >= 100) return { label: "Expert ⚡",      color: "text-yellow-400" };
  if (wpm >= 75)  return { label: "Advanced 🚀",    color: "text-brand-400" };
  if (wpm >= 50)  return { label: "Intermediate 💪", color: "text-blue-400" };
  if (wpm >= 30)  return { label: "Developing 📈",  color: "text-green-400" };
  return             { label: "Beginner 🌱",         color: "text-ink-2" };
}

export function ResultsScreen({
  stats, keystrokeLog, difficulty, onRetry, onNext, saving,
}: ResultsProps) {
  const grade       = wpmGrade(stats.wpm);
  const consistency = calcConsistency(keystrokeLog);
  const topErrors   = getTopBigramErrors(keystrokeLog, 3);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* ── Hero result ────────────────────────────────────────────── */}
      <div className="card p-8 text-center">
        <div className={`text-6xl font-mono font-bold mb-1 ${grade.color}`}>
          {stats.wpm}
        </div>
        <div className="text-ink-2 text-sm mb-2">words per minute</div>
        <div className={`text-base font-medium ${grade.color}`}>{grade.label}</div>
      </div>

      {/* ── Stat grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Raw WPM",    value: stats.rawWpm.toString(),         sub: "unpenalised" },
          { label: "Accuracy",   value: `${stats.accuracy}%`,            sub: `${stats.errorsCount} errors` },
          { label: "Time",       value: formatTime(stats.elapsedMs),     sub: difficulty },
          { label: "Consistency",value: `${consistency}%`,               sub: "rhythm score" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="font-mono text-2xl font-bold text-ink mb-0.5">{s.value}</div>
            <div className="text-xs text-ink-3 uppercase tracking-wider">{s.label}</div>
            <div className="text-xs text-ink-3 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Weakness hints ─────────────────────────────────────────── */}
      {topErrors.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-medium text-ink-2 uppercase tracking-wider mb-3">
            Most-missed character pairs
          </h3>
          <div className="flex gap-3 flex-wrap">
            {topErrors.map((e) => (
              <div
                key={e.bigram}
                className="bg-surface-2 border border-surface-3 rounded-lg px-4 py-2 text-center"
              >
                <div className="font-mono text-lg font-bold text-brand-400">
                  {e.bigram}
                </div>
                <div className="text-xs text-ink-3">{e.count}× missed</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-3 mt-3">
            Practice these bigrams in your next session to break through your ceiling.
          </p>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 btn-ghost py-3 text-base"
        >
          ↺ Retry same passage
        </button>
        <button
          onClick={onNext}
          disabled={saving}
          className="flex-1 btn-primary py-3 text-base"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white 
                               rounded-full animate-spin" />
              Saving…
            </span>
          ) : (
            "Next passage →"
          )}
        </button>
      </div>
    </div>
  );
}