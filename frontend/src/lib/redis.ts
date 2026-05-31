import { createClient } from "redis";

const g = globalThis as unknown as {
  redis: ReturnType<typeof createClient>
};

export const redis = g.redis ?? createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  socket: {
    reconnectStrategy: (r) =>
      Math.min(r * 100, 3000),
  },
});

if (!redis.isOpen)
  redis.connect().catch(console.error);

if (process.env.NODE_ENV !== "production")
  g.redis = redis;

// Submit a score — only updates if higher (GT flag)
export async function submitScore(
  userId: string,
  wpm: number
) {
  const score = Math.round(wpm * 100);
  const p = redis.multi();
  p.zAdd("lb:alltime", {score,value:userId}, {GT:true});
  p.zAdd("lb:weekly",  {score,value:userId}, {GT:true});
  p.zAdd("lb:daily",   {score,value:userId}, {GT:true});
  await p.exec();
}

// Get user's rank across all 3 boards in one call
export async function getUserRank(userId: string) {
  const [alltime, weekly, daily] =
    await Promise.all([
      redis.zRevRank("lb:alltime", userId),
      redis.zRevRank("lb:weekly",  userId),
      redis.zRevRank("lb:daily",   userId),
    ]);
  return {
    alltime: alltime !== null ? alltime + 1 : null,
    weekly:  weekly  !== null ? weekly  + 1 : null,
    daily:   daily   !== null ? daily   + 1 : null,
  };
}