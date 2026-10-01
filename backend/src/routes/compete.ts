import type { FastifyInstance } from "fastify";
import { db } from "../lib/db.js";
import { competitions, competitionRegistrations, users } from "../lib/schema.js";
import { eq, count, desc, and } from "drizzle-orm";
import { redis } from "../lib/redis.js";

export async function competeRoutes(app: FastifyInstance) {

  // GET /api/compete — list upcoming competitions
  app.get("/", async (req, reply) => {
    const list = await db.query.competitions.findMany({
      orderBy: [desc(competitions.scheduledAt)],
      limit: 20,
    });
    // Attach registration counts
    const withCounts = await Promise.all(list.map(async (c) => {
      const [{ value: regCount }] = await db
        .select({ value: count() })
        .from(competitionRegistrations)
        .where(eq(competitionRegistrations.competitionId, c.id));

      const status = c.status === "racing"
        ? "live"
        : c.status === "finished"
        ? "finished"
        : "upcoming";

      return {
        ...c,
        name: c.title,
        scheduledAt: c.scheduledAt,
        maxParticipants: c.maxPlayers,
        registrationCount: Number(regCount),
        status,
      };
    }));
    return { competitions: withCounts };
  });

  // GET /api/compete/:id — single competition detail
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const comp = await db.query.competitions.findFirst({
      where: eq(competitions.id, req.params.id),
    });
    if (!comp) return reply.status(404).send({ error: "Not found" });

    // Live participant count from Redis
    const live = await redis.get(`comp:${req.params.id}`);
    const liveCount = live ? Object.keys(JSON.parse(live).players).length : 0;

    const [{ value: regCount }] = await db
      .select({ value: count() })
      .from(competitionRegistrations)
      .where(eq(competitionRegistrations.competitionId, req.params.id));

    return { competition: comp, liveCount, registrationCount: Number(regCount) };
  });

  // POST /api/compete/:id/register — register a user
  app.post<{ Params: { id: string }; Body: { userId: string } }>(
    "/:id/register", async (req, reply) => {
      const { userId } = req.body;
      if (!userId) return reply.status(400).send({ error: "userId required" });

      const comp = await db.query.competitions.findFirst({
        where: eq(competitions.id, req.params.id),
      });
      if (!comp) return reply.status(404).send({ error: "Competition not found" });

      // Check capacity
      const [{ value: regCount }] = await db
        .select({ value: count() })
        .from(competitionRegistrations)
        .where(eq(competitionRegistrations.competitionId, req.params.id));

      if (Number(regCount) >= (comp.maxPlayers ?? 500)) {
        return reply.status(409).send({ error: "Competition is full" });
      }

      // Upsert registration
      await db.insert(competitionRegistrations).values({
        competitionId: req.params.id,
        userId,
      }).onConflictDoNothing();

      return { ok: true };
    }
  );

  // GET /api/compete/:id/leaderboard — competition-specific leaderboard
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/:id/leaderboard", async (req, reply) => {
      const limit  = Math.min(100, Number(req.query.limit ?? "50"));
      const key    = `comp_lb:${req.params.id}`;
      const scores = await redis.zRangeWithScores(key, 0, limit - 1, { REV: true });

      if (scores.length === 0) return { entries: [], total: 0 };

      // Hydrate user data
      const { inArray } = await import("drizzle-orm");
      const userIds = scores
        .map((s) => s.value)
        .filter((value): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

      const userRows = userIds.length > 0
        ? await db
            .select({ id: users.id, username: users.username, name: users.name, image: users.image })
            .from(users)
            .where(inArray(users.id, userIds))
        : [];

      const umap = Object.fromEntries(userRows.map((u) => [u.id, u]));

      return {
        entries: scores.map((s, i) => ({
          rank:   i + 1,
          userId: s.value,
          wpm:    Math.round(s.score / 100),
          user:   umap[s.value] ?? null,
        })),
        total: await redis.zCard(key),
      };
    }
  );
}
