import type { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import { redis } from "../lib/redis.js";
import { db }    from "../lib/db.js";
import { raceSessions, rooms, passages } from "../lib/schema.js";
import type { KeystrokeEvent } from "../lib/schema.js";
import { eq, inArray } from "drizzle-orm";
import { submitScore } from "../lib/redis.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RaceStatus = "waiting" | "countdown" | "racing" | "finished";

export interface Player {
  userId:   string;
  username: string;
  name:     string;
  image:    string | null;
  socketId: string;
  progress: number;   // 0–100
  wpm:      number;
  accuracy: number;
  finished: boolean;
  finishTime: number | null;
  rank:     number | null;
}

export interface RaceRoom {
  code:        string;
  hostId:      string;
  passageId:   string | null;
  passageText: string;
  status:      RaceStatus;
  players:     Record<string, Player>; // keyed by userId
  maxPlayers:  number;
  startedAt:   number | null;
  finishedAt:  number | null;
  countdownEnd: number | null;
  finishOrder: string[]; // userIds in finish order
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

const ROOM_TTL = 3600; // 1 hour

async function saveRoom(room: RaceRoom) {
  await redis.setEx(`room:${room.code}`, ROOM_TTL, JSON.stringify(room));
}

async function getRoom(code: string): Promise<RaceRoom | null> {
  const raw = await redis.get(`room:${code}`);
  return raw ? JSON.parse(raw) : null;
}

async function deleteRoom(code: string) {
  await redis.del(`room:${code}`);
}

// Map socketId → { userId, roomCode } for disconnect handling
async function saveSocketMap(socketId: string, userId: string, roomCode: string) {
  await redis.setEx(`socket:${socketId}`, ROOM_TTL, JSON.stringify({ userId, roomCode }));
}

async function getSocketMap(socketId: string): Promise<{ userId: string; roomCode: string } | null> {
  const raw = await redis.get(`socket:${socketId}`);
  return raw ? JSON.parse(raw) : null;
}

async function deleteSocketMap(socketId: string) {
  await redis.del(`socket:${socketId}`);
}

// ─── Passage helper ───────────────────────────────────────────────────────────

async function getRandomPassage(): Promise<{ id: string; content: string }> {
  // Pick a random medium passage from DB
  const all = await db.query.passages.findMany({
    where: eq(passages.difficulty, "medium"),
    columns: { id: true, content: true },
    limit: 50,
  });
  if (all.length === 0) {
    return {
      id: "default",
      content: "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.",
    };
  }
  return all[Math.floor(Math.random() * all.length)];
}

// ─── Main socket handler ─────────────────────────────────────────────────────

export function registerRaceSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── CREATE ROOM ──────────────────────────────────────────────────────────
    socket.on("create_room", async (
      data: { userId: string; username: string; name: string; image: string | null; maxPlayers?: number },
      cb: (res: { ok: boolean; code?: string; error?: string }) => void
    ) => {
      try {
        const code    = nanoid(6).toUpperCase();
        const passage = await getRandomPassage();

        const player: Player = {
          userId:     data.userId,
          username:   data.username,
          name:       data.name,
          image:      data.image,
          socketId:   socket.id,
          progress:   0,
          wpm:        0,
          accuracy:   100,
          finished:   false,
          finishTime: null,
          rank:       null,
        };

        const room: RaceRoom = {
          code,
          hostId:       data.userId,
          passageId:    passage.id,
          passageText:  passage.content,
          status:       "waiting",
          players:      { [data.userId]: player },
          maxPlayers:   data.maxPlayers ?? 4,
          startedAt:    null,
          finishedAt:   null,
          countdownEnd: null,
          finishOrder:  [],
        };

        await saveRoom(room);
        await saveSocketMap(socket.id, data.userId, code);
        socket.join(code);

        // Also create room in DB for persistence
        await db.insert(rooms).values({
          code,
          hostId:    data.userId,
          passageId: passage.id !== "default" ? passage.id : null,
          status:    "waiting",
          maxPlayers: data.maxPlayers ?? 4,
        }).onConflictDoNothing();

        cb({ ok: true, code });
        console.log(`[room] created: ${code} by ${data.userId}`);
      } catch (err) {
        console.error("[create_room]", err);
        cb({ ok: false, error: "Failed to create room" });
      }
    });

    // ── JOIN ROOM ────────────────────────────────────────────────────────────
    socket.on("join_room", async (
      data: { code: string; userId: string; username: string; name: string; image: string | null },
      cb: (res: { ok: boolean; room?: RaceRoom; error?: string }) => void
    ) => {
      try {
        const room = await getRoom(data.code);
        if (!room) return cb({ ok: false, error: "Room not found" });
        if (room.status !== "waiting") return cb({ ok: false, error: "Race already started" });
        if (Object.keys(room.players).length >= room.maxPlayers) return cb({ ok: false, error: "Room is full" });

        // If player is rejoining (e.g. page refresh) — update socketId
        const existing = room.players[data.userId];
        room.players[data.userId] = {
          userId:     data.userId,
          username:   data.username,
          name:       data.name,
          image:      data.image,
          socketId:   socket.id,
          progress:   existing?.progress ?? 0,
          wpm:        existing?.wpm ?? 0,
          accuracy:   existing?.accuracy ?? 100,
          finished:   existing?.finished ?? false,
          finishTime: existing?.finishTime ?? null,
          rank:       existing?.rank ?? null,
        };

        await saveRoom(room);
        await saveSocketMap(socket.id, data.userId, data.code);
        socket.join(data.code);

        // Notify existing players
        socket.to(data.code).emit("player_joined", {
          player: room.players[data.userId],
          playerCount: Object.keys(room.players).length,
        });

        cb({ ok: true, room });
        console.log(`[room] ${data.userId} joined ${data.code}`);
      } catch (err) {
        console.error("[join_room]", err);
        cb({ ok: false, error: "Failed to join room" });
      }
    });

    // ── GET ROOM STATE ───────────────────────────────────────────────────────
    socket.on("get_room", async (
      data: { code: string },
      cb: (res: { ok: boolean; room?: RaceRoom; error?: string }) => void
    ) => {
      const room = await getRoom(data.code);
      if (!room) return cb({ ok: false, error: "Room not found" });
      cb({ ok: true, room });
    });

    // ── START RACE (host only) ───────────────────────────────────────────────
    socket.on("start_race", async (
      data: { code: string; userId: string },
      cb: (res: { ok: boolean; error?: string }) => void
    ) => {
      try {
        const room = await getRoom(data.code);
        if (!room) return cb({ ok: false, error: "Room not found" });
        if (room.hostId !== data.userId) return cb({ ok: false, error: "Only the host can start the race" });
        if (room.status !== "waiting") return cb({ ok: false, error: "Race already started" });
        if (Object.keys(room.players).length < 1) return cb({ ok: false, error: "Need at least 1 player" });

        // ── COUNTDOWN (3 seconds) ─────────────────────────────────────────
        room.status       = "countdown";
        room.countdownEnd = Date.now() + 3000;
        await saveRoom(room);

        // Broadcast countdown start to ALL players in room
        io.to(data.code).emit("countdown_start", {
          countdownEnd: room.countdownEnd,
          passage:      room.passageText,
        });

        console.log(`[room] countdown started: ${data.code}`);

        // After 3 seconds → start actual race
        setTimeout(async () => {
          const r = await getRoom(data.code);
          if (!r || r.status !== "countdown") return;

          r.status    = "racing";
          r.startedAt = Date.now();
          await saveRoom(r);

          io.to(data.code).emit("race_start", {
            startedAt: r.startedAt,
            passage:   r.passageText,
          });

          // Update DB room status
          await db.update(rooms)
            .set({ status: "racing", startedAt: new Date() })
            .where(eq(rooms.code, data.code));

          console.log(`[room] race started: ${data.code}`);
        }, 3000);

        cb({ ok: true });
      } catch (err) {
        console.error("[start_race]", err);
        cb({ ok: false, error: "Failed to start race" });
      }
    });

    // ── PLAYER PROGRESS ──────────────────────────────────────────────────────
    socket.on("player_progress", async (data: {
      code:     string;
      userId:   string;
      progress: number; // 0–100
      wpm:      number;
      accuracy: number;
    }) => {
      try {
        const room = await getRoom(data.code);
        if (!room || room.status !== "racing") return;
        if (!room.players[data.userId]) return;

        // Update player state
        room.players[data.userId].progress = Math.min(100, Math.max(0, data.progress));
        room.players[data.userId].wpm      = data.wpm;
        room.players[data.userId].accuracy = data.accuracy;

        await saveRoom(room);

        // Broadcast to ALL players in room (including sender for consistency)
        io.to(data.code).emit("progress_update", {
          userId:   data.userId,
          progress: room.players[data.userId].progress,
          wpm:      data.wpm,
          accuracy: data.accuracy,
        });
      } catch (err) {
        console.error("[player_progress]", err);
      }
    });

    // ── PLAYER FINISHED ──────────────────────────────────────────────────────
    socket.on("player_finished", async (data: {
      code:       string;
      userId:     string;
      wpm:        number;
      rawWpm:     number;
      accuracy:   number;
      timeTakenMs: number;
      keystrokeLog?: object[];
    }, cb: (res: { ok: boolean; rank?: number; error?: string }) => void) => {
      try {
        const room = await getRoom(data.code);
        if (!room || room.status !== "racing") return cb({ ok: false, error: "Race not active" });
        if (!room.players[data.userId]) return cb({ ok: false, error: "Player not in room" });
        if (room.players[data.userId].finished) return cb({ ok: false, error: "Already finished" });

        const finishTime = Date.now();
        const rank       = room.finishOrder.length + 1;

        room.players[data.userId].finished   = true;
        room.players[data.userId].finishTime = finishTime;
        room.players[data.userId].rank       = rank;
        room.players[data.userId].wpm        = data.wpm;
        room.players[data.userId].accuracy   = data.accuracy;
        room.players[data.userId].progress   = 100;
        room.finishOrder.push(data.userId);

        await saveRoom(room);

        // Save race session to DB
        await db.insert(raceSessions).values({
          userId:      data.userId,
          mode:        "multiplayer",
          difficulty:  "medium",
          roomCode:    data.code,
          wpm:         data.wpm,
          rawWpm:      data.rawWpm,
          accuracy:    data.accuracy,
          timeTakenMs: data.timeTakenMs,
          rank,
          keystrokeLog: (data.keystrokeLog ?? []) as KeystrokeEvent[],
          completedAt: new Date(),
        });

        // Update Redis leaderboard
        await submitScore(data.userId, data.wpm);

        // Broadcast finish to all players
        io.to(data.code).emit("player_finish", {
          userId:   data.userId,
          rank,
          wpm:      data.wpm,
          accuracy: data.accuracy,
          finishTime,
        });

        console.log(`[room] ${data.userId} finished rank #${rank} in ${data.code}`);

        // Check if ALL players finished → end race
        const allPlayers  = Object.values(room.players);
        const allFinished = allPlayers.every((p) => p.finished);

        if (allFinished) {
          room.status     = "finished";
          room.finishedAt = Date.now();
          await saveRoom(room);

          const standings = room.finishOrder.map((uid, i) => ({
            rank:     i + 1,
            userId:   uid,
            wpm:      room.players[uid].wpm,
            accuracy: room.players[uid].accuracy,
            name:     room.players[uid].name,
            username: room.players[uid].username,
            image:    room.players[uid].image,
          }));

          io.to(data.code).emit("race_finished", { standings });

          await db.update(rooms)
            .set({ status: "finished", finishedAt: new Date() })
            .where(eq(rooms.code, data.code));

          console.log(`[room] all finished: ${data.code}`);
        }

        cb({ ok: true, rank });
      } catch (err) {
        console.error("[player_finished]", err);
        cb({ ok: false, error: "Failed to record finish" });
      }
    });

    // ── LEAVE ROOM ────────────────────────────────────────────────────────────
    socket.on("leave_room", async (data: { code: string; userId: string }) => {
      await handleLeave(socket, io, data.code, data.userId);
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      console.log(`[socket] disconnected: ${socket.id} — ${reason}`);
      const map = await getSocketMap(socket.id);
      if (map) {
        await handleLeave(socket, io, map.roomCode, map.userId);
        await deleteSocketMap(socket.id);
      }
    });
  });
}

// ─── Leave helper ─────────────────────────────────────────────────────────────

async function handleLeave(
  socket: Socket,
  io:     Server,
  code:   string,
  userId: string,
) {
  try {
    const room = await getRoom(code);
    if (!room) return;

    delete room.players[userId];
    socket.leave(code);

    const remaining = Object.keys(room.players).length;

    if (remaining === 0) {
      // Last player left — delete room
      await deleteRoom(code);
      await db.update(rooms).set({ status: "finished" }).where(eq(rooms.code, code));
      console.log(`[room] deleted empty room: ${code}`);
    } else {
      // If host left — assign new host
      if (room.hostId === userId) {
        room.hostId = Object.values(room.players)[0].userId;
        io.to(code).emit("host_changed", { newHostId: room.hostId });
      }
      await saveRoom(room);
      io.to(code).emit("player_left", { userId, playerCount: remaining });
    }
  } catch (err) {
    console.error("[handleLeave]", err);
  }
}
