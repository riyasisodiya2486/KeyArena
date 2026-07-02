import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { raceSessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { KeystrokeEvent } from "@/lib/db/schema";

// ─── Analysis helpers ─────────────────────────────────────────────────────────

function getBigramErrors(log: KeystrokeEvent[]): { bigram: string; count: number }[] {
  const map: Record<string, number> = {};
  for (let i = 1; i < log.length; i++) {
    if (!log[i].correct) {
      const bg = log[i - 1].expected + log[i].expected;
      map[bg] = (map[bg] ?? 0) + 1;
    }
  }
  return Object.entries(map)
    .map(([bigram, count]) => ({ bigram, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function getCharErrors(log: KeystrokeEvent[]): { char: string; count: number }[] {
  const map: Record<string, number> = {};
  log.filter(k => !k.correct).forEach(k => {
    map[k.expected] = (map[k.expected] ?? 0) + 1;
  });
  return Object.entries(map)
    .map(([char, count]) => ({ char, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function getConsistency(log: KeystrokeEvent[]): number {
  if (log.length < 3) return 100;
  const gaps = log.slice(1).map((k, i) => k.timestamp - log[i].timestamp);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const std  = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  return Math.max(0, Math.min(100, Math.round(100 - std / 4)));
}

function getWpmTrend(sessions: { wpm: number | null; completedAt: Date | null }[]) {
  return sessions
    .filter(s => s.wpm && s.completedAt)
    .slice(0, 20)
    .reverse()
    .map((s, i) => ({
      race:       i + 1,
      wpm:        Math.round(s.wpm!),
      completedAt: s.completedAt!.toISOString(),
    }));
}

// ─── GET /api/insights ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch last 50 sessions
  const sessions = await db.query.raceSessions.findMany({
    where: eq(raceSessions.userId, session.user.id),
    orderBy: [desc(raceSessions.completedAt)],
    limit: 50,
  });

  if (sessions.length === 0) {
    return NextResponse.json({
      hasData:       false,
      message:       "Complete at least one race to see insights.",
    });
  }

  // Aggregate all keystroke logs
  const allLogs: KeystrokeEvent[] = sessions
    .flatMap(s => (s.keystrokeLog ?? []) as KeystrokeEvent[]);

  const totalKeystrokes = allLogs.length;
  const totalErrors     = allLogs.filter(k => !k.correct).length;
  const overallAccuracy = totalKeystrokes > 0
    ? Math.round(((totalKeystrokes - totalErrors) / totalKeystrokes) * 100)
    : 100;

  const bigramErrors = getBigramErrors(allLogs);
  const charErrors   = getCharErrors(allLogs);
  const consistency  = getConsistency(allLogs);
  const wpmTrend     = getWpmTrend(sessions);

  // WPM stats
  const wpms     = sessions.map(s => s.wpm ?? 0).filter(Boolean);
  const avgWpm   = wpms.length ? Math.round(wpms.reduce((a,b) => a+b, 0) / wpms.length) : 0;
  const bestWpm  = wpms.length ? Math.max(...wpms) : 0;
  const recentAvg = wpms.slice(0, 5).length
    ? Math.round(wpms.slice(0, 5).reduce((a,b) => a+b, 0) / wpms.slice(0, 5).length)
    : 0;

  // Weak spots — top 5 chars by error frequency
  const weakChars = charErrors.slice(0, 5).map(e => e.char);

  return NextResponse.json({
    hasData:         true,
    totalRaces:      sessions.length,
    totalKeystrokes,
    overallAccuracy,
    consistency,
    avgWpm,
    bestWpm,
    recentAvg,
    improving:       recentAvg > avgWpm,
    bigramErrors:    bigramErrors.slice(0, 8),
    charErrors:      charErrors.slice(0, 8),
    weakChars,
    wpmTrend,
  });
}
