import type { FastifyInstance } from "fastify";
import { inArray } from "drizzle-orm";
import { db } from "../lib/db.js";
import { users } from "../lib/schema.js";
import { getBoardCount, getTopN, getUserRank, getUserScore, type BoardType } from "../lib/redis.js";

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { board?: string; page?: string; limit?: string; userId?: string } }>("/", async (req, reply) => {
    const board = (req.query.board ?? "alltime") as BoardType;
    const page = Math.max(1, Number(req.query.page ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? "50")));
    const offset = (page - 1) * limit;

    if (!["alltime", "weekly", "daily"].includes(board)) {
      return reply.status(400).send({ error: "Invalid board" });
    }

    const entries = await getTopN(board, limit, offset);
    const total = await getBoardCount(board);

    let userMap: Record<string, { id: string; username: string | null; name: string | null; image: string | null }> = {};
    if (entries.length > 0) {
      const userIds = entries.map((entry) => entry.value);
      const userRows = await db
        .select({ id: users.id, username: users.username, name: users.name, image: users.image })
        .from(users)
        .where(inArray(users.id, userIds));

      userMap = Object.fromEntries(userRows.map((user) => [user.id, user]));
    }

    return {
      entries: entries.map((entry, i) => ({
        rank: offset + i + 1,
        userId: entry.value,
        wpm: Math.round(entry.score / 100),
        user: userMap[entry.value] ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      currentUserRank: req.query.userId ? await getUserRank(req.query.userId) : null,
      currentUserScore: req.query.userId ? await getUserScore(req.query.userId, board) : null,
    };
  });

  app.get<{ Querystring: { userId: string } }>("/me", async (req, reply) => {
    const { userId } = req.query;
    if (!userId) return reply.status(400).send({ error: "userId required" });

    const [rank, scores] = await Promise.all([
      getUserRank(userId),
      Promise.all([
        getUserScore(userId, "alltime"),
        getUserScore(userId, "weekly"),
        getUserScore(userId, "daily"),
      ]),
    ]);

    return {
      rank,
      wpm: {
        alltime: scores[0],
        weekly: scores[1],
        daily: scores[2],
      },
    };
  });
}