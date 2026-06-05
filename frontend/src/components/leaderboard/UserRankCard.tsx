"use client";

import Link from "next/link";
import type { BoardType } from "@/lib/redis";

interface UserRankCardProps {
  rank:  { alltime: number | null; weekly: number | null; daily: number | null } | null;
  wpm:   number | null;
  board: BoardType;
}

export function UserRankCard({ rank, wpm, board }: UserRankCardProps) {
  if (!rank) {
    // Not signed in
    return (
      <div className="card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-ink">Your rank</p>
          <p className="text-xs text-ink-2 mt-0.5">
            Sign in and complete a race to appear on the leaderboard.
          </p>
        </div>
        <Link href="/auth/signin?callbackUrl=/leaderboard" className="btn-primary text-xs px-4 py-2 flex-shrink-0">
          Sign in →
        </Link>
      </div>
    );
  }

  const currentRank  = rank[board];
  const boardLabels  = { alltime: "all time", weekly: "this week", daily: "today" };

  if (!currentRank) {
    // Signed in but no score yet for this board
    return (
      <div className="card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-ink">Your rank ({boardLabels[board]})</p>
          <p className="text-xs text-ink-2 mt-0.5">
            Complete a race to get ranked on this leaderboard.
          </p>
        </div>
        <Link href="/practice" className="btn-primary text-xs px-4 py-2 flex-shrink-0">
          Start racing →
        </Link>
      </div>
    );
  }

  return (
    <div className="card px-5 py-4 flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-400/10 border border-brand-400/20
                        flex items-center justify-center">
          <span className="text-lg">🏆</span>
        </div>
        <div>
          <p className="text-xs text-ink-3 uppercase tracking-wider">Your rank</p>
          <p className="font-mono text-2xl font-bold text-brand-400">
            #{currentRank.toLocaleString()}
          </p>
        </div>
      </div>

      {wpm !== null && (
        <div>
          <p className="text-xs text-ink-3 uppercase tracking-wider">Best WPM</p>
          <p className="font-mono text-2xl font-bold text-ink">{wpm}</p>
        </div>
      )}

      <div className="hidden sm:flex items-center gap-4 ml-auto">
        {(["alltime", "weekly", "daily"] as BoardType[]).map((b) => (
          <div key={b} className="text-center">
            <p className="text-xs text-ink-3">{boardLabels[b]}</p>
            <p className={`font-mono text-sm font-bold ${rank[b] ? "text-ink" : "text-ink-3"}`}>
              {rank[b] ? `#${rank[b]!.toLocaleString()}` : "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
