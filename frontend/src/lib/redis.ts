import { createClient } from "redis";

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient>;
};

export const redis =
  globalForRedis.redis ??
  createClient({
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
  });

let redisReady = redis.isOpen;

const redisReadyPromise = redis.isOpen
  ? Promise.resolve(true)
  : redis.connect()
      .then(() => {
        redisReady = true;
        return true;
      })
      .catch((error) => {
        redisReady = false;
        console.warn("Redis unavailable; leaderboard data will fall back to empty results.", error);
        return false;
      });

async function ensureRedisReady() {
  if (redisReady) return true;
  return redisReadyPromise;
}

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ─── Key constants ────────────────────────────────────────────────────────────

export const LB_KEYS = {
  alltime: "lb:alltime",
  weekly:  "lb:weekly",
  daily:   "lb:daily",
} as const;

export type BoardType = keyof typeof LB_KEYS;

// ─── Submit score — only updates if higher (GT flag) ─────────────────────────

export async function submitScore(userId: string, wpm: number) {
  if (!(await ensureRedisReady())) return;
  const score    = Math.round(wpm * 100); // multiply by 100 for decimal precision
  const pipeline = redis.multi();
  pipeline.zAdd(LB_KEYS.alltime, { score, value: userId }, { GT: true });
  pipeline.zAdd(LB_KEYS.weekly,  { score, value: userId }, { GT: true });
  pipeline.zAdd(LB_KEYS.daily,   { score, value: userId }, { GT: true });
  await pipeline.exec();
}

// ─── Get user rank across all 3 boards in one call ───────────────────────────

export async function getUserRank(userId: string): Promise<{
  alltime: number | null;
  weekly:  number | null;
  daily:   number | null;
}> {
  if (!(await ensureRedisReady())) {
    return { alltime: null, weekly: null, daily: null };
  }

  const [alltime, weekly, daily] = await Promise.all([
    redis.zRevRank(LB_KEYS.alltime, userId),
    redis.zRevRank(LB_KEYS.weekly,  userId),
    redis.zRevRank(LB_KEYS.daily,   userId),
  ]);
  return {
    alltime: alltime !== null ? alltime + 1 : null,
    weekly:  weekly  !== null ? weekly  + 1 : null,
    daily:   daily   !== null ? daily   + 1 : null,
  };
}

// ─── Get user's best score from a board ──────────────────────────────────────

export async function getUserScore(userId: string, board: BoardType): Promise<number | null> {
  if (!(await ensureRedisReady())) return null;
  const raw = await redis.zScore(LB_KEYS[board], userId);
  return raw !== null ? raw / 100 : null; // divide back to WPM
}

// ─── Get top N entries (paginated) ───────────────────────────────────────────

export async function getTopN(
  board: BoardType,
  limit  = 50,
  offset = 0,
): Promise<{ value: string; score: number }[]> {
  if (!(await ensureRedisReady())) return [];

  const entries = await redis.zRangeWithScores(
    LB_KEYS[board],
    offset,
    offset + limit - 1,
    { REV: true },
  );
  return entries;
}

// ─── Get total count of ranked users ─────────────────────────────────────────

export async function getBoardCount(board: BoardType): Promise<number> {
  if (!(await ensureRedisReady())) return 0;
  return redis.zCard(LB_KEYS[board]);
}

// ─── Race room state ──────────────────────────────────────────────────────────

export async function setRaceState(roomCode: string, state: object, ttlSeconds = 3600) {
  if (!(await ensureRedisReady())) return;
  await redis.setEx(`race:${roomCode}`, ttlSeconds, JSON.stringify(state));
}

export async function getRaceState(roomCode: string) {
  if (!(await ensureRedisReady())) return null;
  const raw = await redis.get(`race:${roomCode}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteRaceState(roomCode: string) {
  if (!(await ensureRedisReady())) return;
  await redis.del(`race:${roomCode}`);
}

// ─── Auto-expire daily/weekly boards ─────────────────────────────────────────

export async function setLeaderboardExpiry() {
  if (!(await ensureRedisReady())) return;
  const now = new Date();

  // Daily: expires at next UTC midnight
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const dailyTTL = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  // Weekly: expires next Monday UTC midnight
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  const weeklyTTL = Math.floor((nextMonday.getTime() - now.getTime()) / 1000);

  await Promise.all([
    redis.expire(LB_KEYS.daily,  dailyTTL),
    redis.expire(LB_KEYS.weekly, weeklyTTL),
  ]);
}
