import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/config";
import { Navbar } from "@/components/layout/Navbar";
import { PersonalStats } from "@/components/practice/PersonalStats";
import { db } from "@/lib/db";
import { raceSessions } from "@/lib/db/schema";
import { eq, desc, avg, count, max, sum } from "drizzle-orm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Stats" };

export default async function StatsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const userId = session.user.id;

  const [aggregate] = await db
    .select({
      avgWpm:      avg(raceSessions.wpm),
      bestWpm:     max(raceSessions.wpm),
      avgAccuracy: avg(raceSessions.accuracy),
      totalRaces:  count(raceSessions.id),
      totalTimeMs: sum(raceSessions.timeTakenMs),
    })
    .from(raceSessions)
    .where(eq(raceSessions.userId, userId));

  const recentSessions = await db.query.raceSessions.findMany({
    where: eq(raceSessions.userId, userId),
    orderBy: [desc(raceSessions.completedAt)],
    limit: 50,
  });

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-mono text-ink">My stats</h1>
          <p className="text-sm text-ink-2 mt-1">Your personal typing history</p>
        </div>
        <PersonalStats
          sessions={recentSessions}
          avgWpm={aggregate.avgWpm ? Math.round(Number(aggregate.avgWpm)) : 0}
          bestWpm={aggregate.bestWpm ? Math.round(Number(aggregate.bestWpm)) : 0}
          avgAccuracy={aggregate.avgAccuracy ? Math.round(Number(aggregate.avgAccuracy)) : 0}
          totalRaces={Number(aggregate.totalRaces ?? 0)}
          totalTimeMs={Number(aggregate.totalTimeMs ?? 0)}
        />
      </main>
    </>
  );
}