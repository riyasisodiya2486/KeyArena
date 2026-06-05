import type { FastifyInstance } from "fastify";
import { createClient } from "redis";
import { db } from "../lib/db.js";
import { users } from "../lib/schema.js";
import { inArray } from "drizzle-orm";

const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
await redis.connect();
let redisReady = false;

try {
  await redis.connect();
  redisReady = true;
} catch {
  redisReady = false;
}

const LB_KEYS = {
  alltime: "lb:alltime",
  weekly:  "lb:weekly",
  daily:   "lb:daily",
} as const;

type BoardType = keyof typeof LB_KEYS;

export async function leaderboardRoutes(app: FastifyInstance) {

  // GET /api/leaderboard?board=alltime&page=1&limit=50
  app.get<{
    Querystring: { board?: string; page?: string; limit?: string; userId?: string };
  }>("/", async (req, reply) => {
    const board  = (req.query.board ?? "alltime") as BoardType;
    const page   = Math.max(1, Number(req.query.page  ?? "1"));
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit ?? "50")));
    const offset = (page - 1) * limit;

    if (!["alltime", "weekly", "daily"].includes(board)) {
      return reply.status(400).send({ error: "Invalid board" });
    }

    if (!redisReady) {
      return { entries: [], total: 0, page, limit, totalPages: 0 };
    }

    const key     = LB_KEYS[board];
    const entries = await redis.zRangeWithScores(key, offset, offset + limit - 1, { REV: true });
    const total   = await redis.zCard(key);

    if (entries.length === 0) {
      return { entries: [], total: 0, page, limit, totalPages: 0 };
    }

    // Hydrate user profiles from Postgres
    const userIds  = entries.map((e) => e.value);
    const userRows = await db
      .select({ id: users.id, username: users.username, name: users.name, image: users.image })
      .from(users)
      .where(inArray(users.id, userIds));

    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));

    return {
      entries: entries.map((e, i) => ({
        rank:   offset + i + 1,
        userId: e.value,
        wpm:    Math.round(e.score / 100),
        user:   userMap[e.value] ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });

  // GET /api/leaderboard/me?userId=xxx — instant rank lookup
  app.get<{ Querystring: { userId: string } }>("/me", async (req, reply) => {
    const { userId } = req.query;
    if (!userId) return reply.status(400).send({ error: "userId required" });

    if (!redisReady) {
      return {
        rank: { alltime: null, weekly: null, daily: null },
        wpm: { alltime: null, weekly: null, daily: null },
      };
    }

    const [alltime, weekly, daily] = await Promise.all([
      redis.zRevRank(LB_KEYS.alltime, userId),
      redis.zRevRank(LB_KEYS.weekly,  userId),
      redis.zRevRank(LB_KEYS.daily,   userId),
    ]);

    const [atScore, wkScore, dyScore] = await Promise.all([
      redis.zScore(LB_KEYS.alltime, userId),
      redis.zScore(LB_KEYS.weekly,  userId),
      redis.zScore(LB_KEYS.daily,   userId),
    ]);

    return {
      rank: {
        alltime: alltime !== null ? alltime + 1 : null,
        weekly:  weekly  !== null ? weekly  + 1 : null,
        daily:   daily   !== null ? daily   + 1 : null,
      },
      wpm: {
        alltime: atScore !== null ? Math.round(atScore / 100) : null,
        weekly:  wkScore !== null ? Math.round(wkScore / 100) : null,
        daily:   dyScore !== null ? Math.round(dyScore / 100) : null,
      },
    };
  });
}
