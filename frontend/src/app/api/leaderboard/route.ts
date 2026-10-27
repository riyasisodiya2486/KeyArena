import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getTopN, getUserRank, getUserScore, getBoardCount, type BoardType } from "@/lib/redis";
import { db } from "@/lib/db";
import { users, raceSessions } from "@/lib/db/schema";
import { inArray, and, gte, lt, isNotNull, sql, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function dayStartUTC(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function weekStartUTC(date = new Date()) {
  const start = dayStartUTC(date);
  const day = start.getUTCDay();
  const diff = (day + 6) % 7;
  start.setUTCDate(start.getUTCDate() - diff);
  return start;
}

function boardRange(board: "daily" | "weekly") {
  const now = new Date();
  if (board === "daily") {
    const start = dayStartUTC(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }
  const start = weekStartUTC(now);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

async function timeFilteredEntries(board: "daily" | "weekly", limit: number, offset: number) {
  const { start, end } = boardRange(board);

  const rows = await db
    .select({
      userId: raceSessions.userId,
      bestWpm: sql<number>`MAX(${raceSessions.wpm})`.as("best_wpm"),
    })
    .from(raceSessions)
    .where(
      and(
        gte(raceSessions.completedAt, start),
        lt(raceSessions.completedAt, end),
        isNotNull(raceSessions.wpm),
      ),
    )
    .groupBy(raceSessions.userId)
    .orderBy(desc(sql`MAX(${raceSessions.wpm})`));

  const all = rows.map((row) => ({
    userId: row.userId as string,
    wpm: Math.round(Number(row.bestWpm ?? 0)),
  }));

  const total = all.length;
  const pageRows = all.slice(offset, offset + limit);

  let userMap: Record<string, any> = {};
  const ids = pageRows.map((e) => e.userId);
  if (ids.length > 0) {
    const userRows = await db
      .select({ id: users.id, username: users.username, name: users.name, image: users.image })
      .from(users)
      .where(inArray(users.id, ids));
    userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));
  }

  const session = await getServerSession(authOptions);

  const entries = pageRows.map((row, i) => ({
    rank: offset + i + 1,
    userId: row.userId,
    wpm: row.wpm,
    user: userMap[row.userId] ?? null,
    isMe: row.userId === session?.user?.id,
  }));

  let currentUserRankForBoard: number | null = null;
  let currentUserScoreForBoard: number | null = null;
  if (session?.user?.id) {
    const idx = all.findIndex((r) => r.userId === session.user.id);
    if (idx >= 0) {
      currentUserRankForBoard = idx + 1;
      currentUserScoreForBoard = all[idx].wpm;
    }
  }

  return { entries, total, all, currentUserRankForBoard, currentUserScoreForBoard };
}

async function userTimeFilteredBest(userId: string, board: "daily" | "weekly") {
  const { start, end } = boardRange(board);
  const [row] = await db
    .select({ bestWpm: sql<number>`MAX(${raceSessions.wpm})` })
    .from(raceSessions)
    .where(
      and(
        eq(raceSessions.userId, userId),
        gte(raceSessions.completedAt, start),
        lt(raceSessions.completedAt, end),
        isNotNull(raceSessions.wpm),
      ),
    );
  const value = row?.bestWpm;
  return value != null ? Math.round(Number(value)) : null;
}

async function userTimeFilteredRank(userId: string, board: "daily" | "weekly") {
  const { start, end } = boardRange(board);
  const rows = await db
    .select({ userId: raceSessions.userId, bestWpm: sql<number>`MAX(${raceSessions.wpm})` })
    .from(raceSessions)
    .where(
      and(
        gte(raceSessions.completedAt, start),
        lt(raceSessions.completedAt, end),
        isNotNull(raceSessions.wpm),
      ),
    )
    .groupBy(raceSessions.userId)
    .orderBy(desc(sql`MAX(${raceSessions.wpm})`));
  const idx = rows.findIndex((r) => r.userId === userId);
  return idx >= 0 ? idx + 1 : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const board = (searchParams.get("board") ?? "alltime") as BoardType;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  if (!["alltime", "weekly", "daily"].includes(board)) {
    return NextResponse.json({ error: "Invalid board" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);

  if (board === "daily" || board === "weekly") {
    const tf = await timeFilteredEntries(board, limit, offset);

    let currentUserRank: { alltime: number | null; weekly: number | null; daily: number | null } | null = null;
    let scoreAlltime: number | null = null;
    let scoreWeekly: number | null = null;
    let scoreDaily: number | null = null;

    if (session?.user?.id) {
      const alltimeRank = await getUserRank(session.user.id).then((r) => r.alltime);
      const weeklyRank = await userTimeFilteredRank(session.user.id, "weekly");
      const dailyRank = await userTimeFilteredRank(session.user.id, "daily");
      currentUserRank = { alltime: alltimeRank, weekly: weeklyRank, daily: dailyRank };
      scoreAlltime = await getUserScore(session.user.id, "alltime");
      scoreWeekly = await userTimeFilteredBest(session.user.id, "weekly");
      scoreDaily = await userTimeFilteredBest(session.user.id, "daily");
    }

    const currentScore = board === "weekly" ? scoreWeekly : scoreDaily;

    return NextResponse.json({
      entries: tf.entries,
      total: tf.total,
      page,
      limit,
      totalPages: Math.ceil(tf.total / limit) || 1,
      currentUserRank,
      currentUserScore: currentScore,
      currentUserScores: {
        alltime: scoreAlltime,
        weekly: scoreWeekly,
        daily: scoreDaily,
      },
    });
  }

  // All-time board (Redis)
  const entries = await getTopN("alltime", limit, offset);
  const total = await getBoardCount("alltime");

  let userMap: Record<string, any> = {};
  if (entries.length > 0) {
    const userIds = entries
      .map((e) => e.value)
      .filter((value): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

    if (userIds.length > 0) {
      const userRows = await db
        .select({ id: users.id, username: users.username, name: users.name, image: users.image })
        .from(users)
        .where(inArray(users.id, userIds));
      userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));
    }
  }

  const currentUserRank = session?.user?.id ? await getUserRank(session.user.id) : null;
  const scoreAlltime = session?.user?.id ? await getUserScore(session.user.id, "alltime") : null;
  const scoreWeekly = session?.user?.id ? await userTimeFilteredBest(session.user.id, "weekly") : null;
  const scoreDaily = session?.user?.id ? await userTimeFilteredBest(session.user.id, "daily") : null;

  const result = entries.map((entry, i) => ({
    rank: offset + i + 1,
    userId: entry.value,
    wpm: Math.round(entry.score / 100),
    user: userMap[entry.value] ?? null,
    isMe: entry.value === session?.user?.id,
  }));

  return NextResponse.json({
    entries: result,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    currentUserRank,
    currentUserScore: scoreAlltime,
    currentUserScores: {
      alltime: scoreAlltime,
      weekly: scoreWeekly,
      daily: scoreDaily,
    },
  });
}
