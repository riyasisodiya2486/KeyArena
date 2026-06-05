"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { BoardTabs }        from "@/components/leaderboard/BoardTabs";
import { LeaderboardTable, type LeaderboardEntry } from "@/components/leaderboard/LeaderboardTable";
import { Pagination }       from "@/components/leaderboard/Pagination";
import { UserRankCard }     from "@/components/leaderboard/UserRankCard";
import type { BoardType }   from "@/lib/redis";

interface LeaderboardData {
  entries:          LeaderboardEntry[];
  total:            number;
  page:             number;
  limit:            number;
  totalPages:       number;
  currentUserRank:  { alltime: number | null; weekly: number | null; daily: number | null } | null;
  currentUserScore: number | null;
}

const LIMIT = 25;

export function LeaderboardClient() {
  const [board,      setBoard]      = useState<BoardType>("alltime");
  const [page,       setPage]       = useState(1);
  const [data,       setData]       = useState<LeaderboardData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPending,  startTransition] = useTransition();

  const fetchLeaderboard = useCallback(async (b: BoardType, p: number) => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/leaderboard?board=${b}&page=${p}&limit=${LIMIT}`);
      if (!res.ok) throw new Error("Failed to load leaderboard");
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      setError("Failed to load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when board/page changes
  useEffect(() => {
    fetchLeaderboard(board, page);
  }, [board, page, fetchLeaderboard]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaderboard(board, page);
    }, 30_000);
    return () => clearInterval(interval);
  }, [board, page, fetchLeaderboard]);

  function handleBoardChange(b: BoardType) {
    startTransition(() => {
      setBoard(b);
      setPage(1);
    });
  }

  function handlePageChange(p: number) {
    startTransition(() => {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="space-y-4">

      {/* Your rank card */}
      <UserRankCard
        rank={data?.currentUserRank ?? null}
        wpm={data?.currentUserScore ?? null}
        board={board}
      />

      {/* Board filter tabs */}
      <BoardTabs value={board} onChange={handleBoardChange} />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider">
            {board === "alltime" ? "All-time rankings" :
             board === "weekly"  ? "This week's rankings" :
                                   "Today's rankings"}
          </h2>
          {data && (
            <p className="text-xs text-ink-3 mt-0.5">
              {data.total.toLocaleString()} racers ranked
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastUpdate && (
            <p className="text-xs text-ink-3">
              Updated {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <button
            onClick={() => fetchLeaderboard(board, page)}
            disabled={loading}
            className="text-xs text-ink-3 hover:text-ink-2 transition-colors
                       flex items-center gap-1.5 disabled:opacity-40"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={loading ? "animate-spin" : ""}>
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4
                        text-sm text-red-400 flex items-center gap-3">
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={() => fetchLeaderboard(board, page)}
            className="ml-auto text-red-400 hover:text-red-300 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <LeaderboardTable
        entries={data?.entries ?? []}
        loading={loading && !data}
      />

      {/* Pagination */}
      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onChange={handlePageChange}
        />
      )}

      {/* Reset info */}
      {board !== "alltime" && !loading && (
        <p className="text-xs text-ink-3 text-center pt-2">
          {board === "weekly"
            ? "⏱ Resets every Monday at midnight UTC"
            : "⏱ Resets every day at midnight UTC"}
        </p>
      )}
    </div>
  );
}
