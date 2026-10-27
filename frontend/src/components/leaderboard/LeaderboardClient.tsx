"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useSession } from "next-auth/react";
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

interface Competition {
  id:   string;
  name: string;
  status: string;
}

type Scope = "overall" | "competition";

const LIMIT = 25;

export function LeaderboardClient() {
  const { data: session } = useSession();
  const [scope, setScope] = useState<Scope>("overall");
  const [board, setBoard] = useState<BoardType>("alltime");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  // Competition scope state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [compEntries, setCompEntries] = useState<LeaderboardEntry[]>([]);
  const [compTotal, setCompTotal] = useState(0);
  const [compLoading, setCompLoading] = useState(false);

  const fetchLeaderboard = useCallback(async (b: BoardType, p: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leaderboard?board=${b}&page=${p}&limit=${LIMIT}`);
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

  useEffect(() => {
    if (scope !== "overall") return;
    fetchLeaderboard(board, page);
  }, [scope, board, page, fetchLeaderboard]);

  useEffect(() => {
    if (scope !== "overall") return;
    const interval = setInterval(() => fetchLeaderboard(board, page), 30_000);
    return () => clearInterval(interval);
  }, [scope, board, page, fetchLeaderboard]);

  // Load competitions when entering competition scope
  useEffect(() => {
    if (scope !== "competition") return;
    let active = true;
    fetch("/api/compete")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        const list: Competition[] = (d?.competitions ?? []).map((c: any) => ({
          id: c.id,
          name: c.name ?? c.title ?? "Competition",
          status: c.status ?? "upcoming",
        }));
        setCompetitions(list);
        if (!competitionId && list.length > 0) setCompetitionId(list[0].id);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [scope, competitionId]);

  const fetchCompetitionLeaderboard = useCallback(async (id: string) => {
    setCompLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/compete/${id}/leaderboard`);
      if (!res.ok) throw new Error("Failed to load competition leaderboard");
      const json = await res.json();
      const mapped: LeaderboardEntry[] = (json.entries ?? []).map((e: any) => ({
        rank: e.rank,
        userId: e.userId,
        wpm: e.wpm,
        isMe: e.userId === session?.user?.id,
        user: e.user ?? null,
      }));
      setCompEntries(mapped);
      setCompTotal(json.total ?? mapped.length);
      setLastUpdate(new Date());
    } catch {
      setError("Failed to load competition leaderboard. Please try again.");
    } finally {
      setCompLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (scope === "competition" && competitionId) {
      fetchCompetitionLeaderboard(competitionId);
    }
  }, [scope, competitionId, fetchCompetitionLeaderboard]);

  function handleScopeChange(next: Scope) {
    startTransition(() => {
      setScope(next);
      setPage(1);
    });
  }

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
      {/* Scope switcher */}
      <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-xl w-fit">
        {(["overall", "competition"] as Scope[]).map((s) => (
          <button
            key={s}
            onClick={() => handleScopeChange(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              scope === s ? "bg-surface-1 text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {s === "overall" ? "Overall rankings" : "Competition rankings"}
          </button>
        ))}
      </div>

      {scope === "overall" && (
        <>
          <UserRankCard
            rank={data?.currentUserRank ?? null}
            wpm={data?.currentUserScore ?? null}
            board={board}
          />

          <BoardTabs value={board} onChange={handleBoardChange} />

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider">
                {board === "alltime" ? "All-time rankings" :
                 board === "weekly" ? "This week's rankings" :
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
                className="text-xs text-ink-3 hover:text-ink-2 transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <LeaderboardTable entries={data?.entries ?? []} loading={loading && !data} />

          {data && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit}
              onChange={handlePageChange}
            />
          )}

          {board !== "alltime" && !loading && (
            <p className="text-xs text-ink-3 text-center pt-2">
              {board === "weekly"
                ? "⏱ Resets every Monday at midnight UTC"
                : "⏱ Resets every day at midnight UTC"}
            </p>
          )}
        </>
      )}

      {scope === "competition" && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-ink-3 uppercase tracking-wider">Competition</label>
            <select
              value={competitionId ?? ""}
              onChange={(e) => setCompetitionId(e.target.value)}
              className="bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-ink"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
            <button
              onClick={() => competitionId && fetchCompetitionLeaderboard(competitionId)}
              disabled={compLoading || !competitionId}
              className="text-xs text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-40"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <LeaderboardTable entries={compEntries} loading={compLoading && compEntries.length === 0} />

          {compTotal > 0 && (
            <p className="text-xs text-ink-3 text-center pt-2">
              {compTotal.toLocaleString()} racers ranked in this competition
            </p>
          )}
        </>
      )}
    </div>
  );
}
