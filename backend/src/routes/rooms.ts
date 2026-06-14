import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db.js";
import { rooms, passages, users } from "../lib/schema.js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { redis } from "../lib/redis.js";
import { z } from "zod";

async function ensureDbUser(hostId: string) {
  const isUuid = z.string().uuid().safeParse(hostId).success;
  const dbHostId = isUuid ? hostId : randomUUID();

  await db.insert(users).values({
    id: dbHostId,
    email: `${dbHostId}@local.invalid`,
    username: `user_${dbHostId.slice(0, 8)}`,
    name: `User ${dbHostId.slice(0, 4)}`,
  }).onConflictDoNothing();

  return dbHostId;
}

export async function roomRoutes(app: FastifyInstance) {

  // POST /api/rooms — create a room via HTTP (alternative to socket)
  app.post<{ Body: { hostId: string; maxPlayers?: number } }>("/", async (req, reply) => {
    const { hostId, maxPlayers = 4 } = req.body;
    if (!hostId) return reply.status(400).send({ error: "hostId required" });

    const code = nanoid(6).toUpperCase();
    const dbHostId = await ensureDbUser(hostId);

    // Get random passage
    const all = await db.query.passages.findMany({
      where: eq(passages.difficulty, "medium"),
      columns: { id: true, content: true },
      limit: 50,
    });
    const passage = all.length > 0
      ? all[Math.floor(Math.random() * all.length)]
      : { id: null, content: "The quick brown fox jumps over the lazy dog." };

    const roomState = {
      code,
      hostId,
      passageId: passage.id,
      passageText: passage.content,
      status: "waiting",
      players: {
        [hostId]: {
          userId: hostId,
          username: hostId,
          name: hostId,
          image: null,
          socketId: "http-create",
          progress: 0,
          wpm: 0,
          accuracy: 100,
          finished: false,
          finishTime: null,
          rank: null,
        },
      },
      maxPlayers,
      startedAt: null,
      finishedAt: null,
      countdownEnd: null,
      finishOrder: [],
    };

    await redis.setEx(`room:${code}`, 3600, JSON.stringify(roomState));

    const [room] = await db.insert(rooms).values({
      code,
      hostId: dbHostId,
      passageId:  passage.id ?? undefined,
      status:     "waiting",
      maxPlayers,
    }).returning();

    return { room: { ...room, hostId }, passage: passage.content };
  });

  // GET /api/rooms/:code — get room info
  app.get<{ Params: { code: string } }>("/:code", async (req, reply) => {
    const { code } = req.params;

    // Try Redis first (live state)
    const live = await redis.get(`room:${code}`);
    if (live) return { room: JSON.parse(live), source: "redis" };

    // Fall back to DB
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, code.toUpperCase()),
    });
    if (!room) return reply.status(404).send({ error: "Room not found" });
    return { room, source: "db" };
  });
}
