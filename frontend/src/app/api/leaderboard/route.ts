import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getTopN, getUserRank, getUserScore, getBoardCount, type BoardType } from "@/lib/redis";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const board  = (searchParams.get("board") ?? "alltime") as BoardType;
  const page   = Math.max(1, Number(searchParams.get("page")  ?? "1"));
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  if (!["alltime", "weekly", "daily"].includes(board)) {
    return NextResponse.json({ error: "Invalid board" }, { status: 400 });
  }

  // 1. Get paginated entries from Redis
  const entries = await getTopN(board, limit, offset);

  // 2. Get total count for pagination UI (Always preserved now)
  const total = await getBoardCount(board);

  // 3. Hydrate user data from Postgres (Only query if we actually have entries)
  let userMap: Record<string, any> = {};
  if (entries.length > 0) {
    const userIds  = entries.map((e) => e.value);
    const userRows = await db
      .select({
        id:       users.id,
        username: users.username,
        name:     users.name,
        image:    users.image,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));
  }

  // 4. Get the current user's rank if they're signed in
  const session     = await getServerSession(authOptions);
  const currentUser = session?.user?.id
    ? await getUserRank(session.user.id)
    : null;

  const currentUserScore = session?.user?.id
    ? await getUserScore(session.user.id, board)
    : null;

  // 5. Build response 
  const result = entries.map((entry, i) => ({
    rank:    offset + i + 1,
    userId:  entry.value,
    wpm:     Math.round(entry.score / 100), 
    user:    userMap[entry.value] ?? null,
    isMe:    entry.value === session?.user?.id,
  }));

  return NextResponse.json({
    entries:          result,
    total,
    page,
    limit,
    totalPages:       Math.ceil(total / limit),
    currentUserRank:  currentUser,
    currentUserScore: currentUserScore,
  });
}