import { Suspense }       from "react";
import { Navbar }         from "@/components/layout/Navbar";
import { LeaderboardClient } from "@/components/leaderboard/LeaderboardClient";
import { getTopN, getUserRank, getUserScore } from "@/lib/redis";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/lib/auth/config";
import { db }                from "@/lib/db";
import { users }             from "@/lib/db/schema";
import { inArray }           from "drizzle-orm";
import Image                 from "next/image";
import type { Metadata }     from "next";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic           = "force-dynamic";

// ─── Top-3 podium (server-rendered) ──────────────────────────────────────────

async function Podium() {
  const top3 = await getTopN("alltime", 3, 0);
  if (top3.length === 0) return null;

  const ids      = top3.map((e) => e.value);
  const userRows = await db
    .select({ id: users.id, username: users.username, name: users.name, image: users.image })
    .from(users)
    .where(inArray(users.id, ids));
  const umap = Object.fromEntries(userRows.map((u) => [u.id, u]));

  const medals = ["🥇", "🥈", "🥉"];
  const heights = ["h-24", "h-16", "h-12"];
  const order  = [1, 0, 2]; // display: 2nd, 1st, 3rd

  return (
    <div className="flex items-end justify-center gap-3 mb-8">
      {order.map((idx) => {
        const entry = top3[idx];
        if (!entry) return null;
        const u    = umap[entry.value];
        const wpm  = Math.round(entry.score / 100);
        const rank = idx + 1;

        return (
          <div key={entry.value}
            className={`flex flex-col items-center gap-2 ${idx === 0 ? "scale-110" : ""}`}>
            {/* Medal */}
            <span className="text-2xl">{medals[idx]}</span>

            {/* Avatar */}
            {u?.image ? (
              <Image src={u.image} alt={u.name ?? ""} width={48} height={48}
                className="rounded-full border-2 border-surface-3" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-400/20 border-2 border-brand-400/30
                              flex items-center justify-center text-lg font-bold text-brand-400">
                {(u?.name ?? u?.username ?? "?").charAt(0).toUpperCase()}
              </div>
            )}

            {/* Name */}
            <div className="text-center">
              <p className="text-xs font-medium text-ink truncate max-w-[80px]">
                {u?.name ?? u?.username ?? "Unknown"}
              </p>
              <p className="font-mono text-sm font-bold text-brand-400">{wpm} wpm</p>
            </div>

            {/* Podium block */}
            <div className={`w-20 ${heights[idx]} bg-surface-2 border border-surface-3
                             rounded-t-lg flex items-center justify-center`}>
              <span className="text-ink-3 text-sm font-mono font-bold">#{rank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface">
        <div className="max-w-3xl mx-auto px-4 py-10">

          {/* Page header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold font-mono text-ink mb-2">Leaderboard</h1>
            <p className="text-ink-2 text-sm">
              Global rankings — updated after every race
            </p>
          </div>

          {/* Top 3 podium */}
          <Suspense fallback={
            <div className="h-40 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
            </div>
          }>
            <Podium />
          </Suspense>

          {/* Full leaderboard (client — tabs, pagination, auto-refresh) */}
          <LeaderboardClient />
        </div>
      </main>
    </>
  );
}
