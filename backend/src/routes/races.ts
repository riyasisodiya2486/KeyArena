import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { raceSessions } from "../lib/schema.js";
import { submitScore } from "../lib/redis.js";

const SaveSchema = z.object({
  userId: z.string().min(1),
  mode: z.enum(["solo", "multiplayer", "competition"]).default("solo"),
  difficulty: z.enum(["easy", "medium", "hard", "code"]).default("medium"),
  wpm: z.number().min(0).max(300),
  rawWpm: z.number().min(0).max(300),
  accuracy: z.number().min(0).max(100),
  charsTyped: z.number().int().min(0),
  errorsCount: z.number().int().min(0),
  timeTakenMs: z.number().int().min(0),
  roomCode: z.string().optional(),
  keystrokeLog: z.array(z.object({
    char: z.string(),
    expected: z.string(),
    timestamp: z.number(),
    correct: z.boolean(),
  })).optional(),
});

export async function raceRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = SaveSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data;

    const [raceSession] = await db
      .insert(raceSessions)
      .values({
        userId: data.userId,
        mode: data.mode,
        difficulty: data.difficulty,
        wpm: data.wpm,
        rawWpm: data.rawWpm,
        accuracy: data.accuracy,
        charsTyped: data.charsTyped,
        errorsCount: data.errorsCount,
        timeTakenMs: data.timeTakenMs,
        roomCode: data.roomCode,
        keystrokeLog: data.keystrokeLog ?? [],
        completedAt: new Date(),
      })
      .returning();

    await submitScore(data.userId, data.wpm);

    return { session: raceSession };
  });

  app.get("/", async (req, reply) => {
    const query = z.object({
      userId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).safeParse(req.query ?? {});

    if (!query.success) {
      return reply.status(400).send({ error: query.error.flatten() });
    }

    const { userId, limit } = query.data;

    const sessions = userId
      ? await db.query.raceSessions.findMany({
          where: eq(raceSessions.userId, userId),
          orderBy: [desc(raceSessions.completedAt)],
          limit,
        })
      : await db.query.raceSessions.findMany({
          orderBy: [desc(raceSessions.completedAt)],
          limit,
        });

    return { sessions };
  });
}