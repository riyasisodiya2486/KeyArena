import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { users, raceSessions } from "@/lib/db/schema";
import { eq, desc, avg, count, max, sum } from "drizzle-orm";
import { getUserRank, getUserScore } from "@/lib/redis";
import { Navbar } from "@/components/layout/Navbar";
import { PersonalStats } from "@/components/practice/PersonalStats";
import { WpmChart } from "@/components/profile/WpmChart";
import Image from "next/image";
import { format } from "date-fns";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, params.username),
  });
  if (!user) notFound();

  const [aggregate] = await db
    .select({
      avgWpm: avg(raceSessions.wpm),
      bestWpm: max(raceSessions.wpm),
      avgAccuracy: avg(raceSessions.accuracy),
      totalRaces: count(raceSessions.id),
      totalTimeMs: sum(raceSessions.timeTakenMs),
    })
    .from(raceSessions)
    .where(eq(raceSessions.userId, user.id));

  const recentSessions = await db.query.raceSessions.findMany({
    where: eq(raceSessions.userId, user.id),
    orderBy: [desc(raceSessions.completedAt)],
    limit: 50,
  });

  const ranks = await getUserRank(user.id);
  const alltimeScore = await getUserScore(user.id, "alltime");

  const chartData = recentSessions
    .slice()
    .reverse()
    .map((s) => ({
      date: s.completedAt
        ? new Date(s.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "",
      wpm: Math.round(s.wpm ?? 0),
    }));

  const session = await getServerSession(authOptions);
  const isMe = session?.user?.id === user.id;

  return (
    <>
      <Navbar />
      <main className="ka-route-page min-h-screen">
        <div className="ka-route-shell space-y-6">
          <div className="card p-6 flex items-center gap-6 flex-wrap">
            {user.image ? (
              <Image src={user.image} alt={user.name ?? ""} width={88} height={88} className="rounded-full border-2 border-surface-3" />
            ) : (
              <div className="w-[88px] h-[88px] rounded-full bg-brand-400/20 border-2 border-brand-400/30 flex items-center justify-center text-3xl font-bold text-brand-400">
                {(user.name ?? user.username ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-ink">{user.name ?? user.username}</h1>
              <p className="text-sm text-ink-2">@{user.username}</p>
              <p className="text-xs text-ink-3 mt-1">Joined {format(new Date(user.createdAt), "MMM d, yyyy")}</p>
              {isMe && <span className="inline-block mt-2 text-xs bg-brand-400/15 text-brand-400 border border-brand-400/30 px-2 py-0.5 rounded">You</span>}
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-xs text-ink-3 uppercase tracking-wider">All-time rank</p>
                <p className="font-mono text-2xl font-bold text-brand-400">{ranks.alltime ? `#${ranks.alltime}` : "—"}</p>
                <p className="text-xs text-ink-3">{alltimeScore ?? 0} wpm</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-ink-3 uppercase tracking-wider">This week</p>
                <p className="font-mono text-2xl font-bold text-ink">{ranks.weekly ? `#${ranks.weekly}` : "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-ink-3 uppercase tracking-wider">Today</p>
                <p className="font-mono text-2xl font-bold text-ink">{ranks.daily ? `#${ranks.daily}` : "—"}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-bold text-ink mb-3">Speed progress</h2>
            <WpmChart data={chartData} />
          </div>

          <PersonalStats
            sessions={recentSessions}
            avgWpm={aggregate.avgWpm ? Math.round(Number(aggregate.avgWpm)) : 0}
            bestWpm={aggregate.bestWpm ? Math.round(Number(aggregate.bestWpm)) : 0}
            avgAccuracy={aggregate.avgAccuracy ? Math.round(Number(aggregate.avgAccuracy)) : 0}
            totalRaces={Number(aggregate.totalRaces ?? 0)}
            totalTimeMs={Number(aggregate.totalTimeMs ?? 0)}
          />
        </div>
      </main>
    </>
  );
}
