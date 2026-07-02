import type { Server, Socket } from "socket.io";
import { redis } from "../lib/redis.js";
import { db } from "../lib/db.js";
import { competitions, competitionRegistrations, raceSessions, passages } from "../lib/schema.js";
import { eq, and } from "drizzle-orm";
import { submitScore } from "../lib/redis.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitionPlayer {
  userId:     string;
  username:   string;
  name:       string;
  image:      string | null;
  socketId:   string;
  progress:   number;
  wpm:        number;
  accuracy:   number;
  finished:   boolean;
  finishTime: number | null;
  rank:       number | null;
}

export interface CompetitionRoom {
  competitionId: string;
  passageText:   string;
  status:        "waiting" | "countdown" | "racing" | "finished";
  players:       Record<string, CompetitionPlayer>;
  startTime:     number | null;
  finishOrder:   string[];
  maxPlayers:    number; // can be 500+
}

const TTL = 7200; // 2 hours

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function getComp(id: string): Promise<CompetitionRoom | null> {
  const raw = await redis.get(`comp:${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveComp(room: CompetitionRoom) {
  await redis.setEx(`comp:${room.competitionId}`, TTL, JSON.stringify(room));
}

// Track socket → userId + competitionId
async function saveSocketMap(socketId: string, userId: string, compId: string) {
  await redis.setEx(`csock:${socketId}`, TTL, JSON.stringify({ userId, compId }));
}
async function getSocketMap(socketId: string) {
  const r = await redis.get(`csock:${socketId}`);
  return r ? JSON.parse(r) as { userId: string; compId: string } : null;
}

// Leaderboard for this competition (separate from global)
function compLbKey(id: string) { return `comp_lb:${id}`; }

export function registerCompetitionSocket(io: Server) {
  // Competition namespace for isolation
  const ns = io.of("/compete");

  async function startCompetitionNow(
    competitionId: string,
    countdownEnd?: number,
    passageOverride?: string,
  ) {
    const room = await getComp(competitionId);
    if (!room) return false;

    if (passageOverride?.trim()) {
      room.passageText = passageOverride.trim();
    }

    const endTs = Math.max(Date.now() + 1000, countdownEnd ?? Date.now() + 3000);
    room.status = "countdown";
    await saveComp(room);

    ns.to(competitionId).emit("countdown_start", {
      countdownEnd: endTs,
      passage: room.passageText,
    });

    const delay = Math.max(0, endTs - Date.now());
    setTimeout(async () => {
      const latest = await getComp(competitionId);
      if (!latest) return;
      latest.status = "racing";
      latest.startTime = Date.now();
      await saveComp(latest);
      ns.to(competitionId).emit("race_start");
    }, delay);

    return true;
  }

  ns.on("connection", async (socket: Socket) => {
    console.log(`[compete] connected: ${socket.id}`);

    // ── JOIN COMPETITION ────────────────────────────────────────────────────
    socket.on("join_competition", async (
      data: { competitionId: string; userId: string; username: string; name: string; image: string | null },
      cb: (res: { ok: boolean; room?: CompetitionRoom; playerCount?: number; error?: string }) => void
    ) => {
      try {
        // Verify registration
        const reg = await db.query.competitionRegistrations.findFirst({
          where: and(
            eq(competitionRegistrations.competitionId, data.competitionId),
            eq(competitionRegistrations.userId, data.userId)
          ),
        });
        if (!reg) return cb({ ok: false, error: "Not registered for this competition" });

        let room = await getComp(data.competitionId);

        // First player — initialize room
        if (!room) {
          const comp = await db.query.competitions.findFirst({
            where: eq(competitions.id, data.competitionId),
          });
          if (!comp) return cb({ ok: false, error: "Competition not found" });

          const passage = await db.query.passages.findFirst({
            where: eq(passages.id, comp.passageId!),
          }) ?? { content: "The quick brown fox jumps over the lazy dog." };

          room = {
            competitionId: data.competitionId,
            passageText:   passage.content,
            status:        "waiting",
            players:       {},
            startTime:     null,
            finishOrder:   [],
            maxPlayers:    comp.maxPlayers ?? 500,
          };
        }

        // Add/rejoin player
        room.players[data.userId] = {
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

        await saveComp(room);
        await saveSocketMap(socket.id, data.userId, data.competitionId);

        socket.join(data.competitionId);

        const playerCount = Object.keys(room.players).length;

        // Broadcast new participant count (lightweight — not full room state)
        socket.to(data.competitionId).emit("participant_joined", { playerCount });

        cb({ ok: true, room, playerCount });
        console.log(`[compete] ${data.userId} joined ${data.competitionId} (${playerCount} total)`);
      } catch (err) {
        console.error("[join_competition]", err);
        cb({ ok: false, error: "Failed to join" });
      }
    });

    // ── PROGRESS (same pattern as rooms but on /compete namespace) ───────────
    socket.on("comp_progress", async (data: {
      competitionId: string;
      userId:        string;
      progress:      number;
      wpm:           number;
      accuracy:      number;
    }) => {
      try {
        const room = await getComp(data.competitionId);
        if (!room || room.status !== "racing") return;
        if (!room.players[data.userId]) return;

        room.players[data.userId].progress = data.progress;
        room.players[data.userId].wpm      = data.wpm;
        room.players[data.userId].accuracy = data.accuracy;
        await saveComp(room);

        // For large events: only broadcast top-25 leaderboard snapshot every event
        // instead of broadcasting every player update (avoids fan-out explosion)
        const topEntries = await redis.zRangeWithScores(compLbKey(data.competitionId), 0, 24, { REV: true });
        ns.to(data.competitionId).emit("comp_leaderboard_update", {
          top25: topEntries.map((e, i) => ({
            rank:   i + 1,
            userId: e.value,
            wpm:    Math.round(e.score / 100),
          })),
          myProgress: {
            userId:   data.userId,
            progress: data.progress,
            wpm:      data.wpm,
          },
          totalPlayers: Object.keys(room.players).length,
        });
      } catch (err) {
        console.error("[comp_progress]", err);
      }
    });

    // ── FINISH ───────────────────────────────────────────────────────────────
    socket.on("comp_finished", async (data: {
      competitionId: string;
      userId:        string;
      wpm:           number;
      rawWpm:        number;
      accuracy:      number;
      timeTakenMs:   number;
      keystrokeLog?: object[];
    }, cb: (res: { ok: boolean; rank?: number; error?: string }) => void) => {
      try {
        const room = await getComp(data.competitionId);
        if (!room || room.status !== "racing") return cb({ ok: false, error: "Not racing" });
        if (!room.players[data.userId]) return cb({ ok: false, error: "Not in competition" });
        if (room.players[data.userId].finished) return cb({ ok: false, error: "Already finished" });

        room.players[data.userId].finished   = true;
        room.players[data.userId].finishTime = Date.now();
        room.players[data.userId].wpm        = data.wpm;
        room.finishOrder.push(data.userId);
        const rank = room.finishOrder.length;
        room.players[data.userId].rank = rank;

        await saveComp(room);

        // Save to global leaderboard (score = wpm * 100)
        await redis.zAdd(compLbKey(data.competitionId), {
          score: data.wpm * 100,
          value: data.userId,
        }, { GT: true });

        // Save race session
        await db.insert(raceSessions).values({
          userId:       data.userId,
          mode:         "competition",
          difficulty:   "medium",
          wpm:          data.wpm,
          rawWpm:       data.rawWpm,
          accuracy:     data.accuracy,
          timeTakenMs:  data.timeTakenMs,
          keystrokeLog: data.keystrokeLog ?? [],
          rank,
          completedAt:  new Date(),
        });

        // Update global leaderboard
        await submitScore(data.userId, data.wpm);

        // Broadcast only to the finishing player + lightweight event to room
        ns.to(data.competitionId).emit("comp_player_finished", {
          userId: data.userId,
          rank,
          wpm:    data.wpm,
        });

        cb({ ok: true, rank });
      } catch (err) {
        console.error("[comp_finished]", err);
        cb({ ok: false, error: "Failed to record finish" });
      }
    });

    // ── DEV TEST TRIGGER: manually start countdown/race ───────────────────
    socket.on("countdown_start", async (
      data: { competitionId?: string; countdownEnd?: number; passage?: string },
      cb?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      try {
        let compId = data.competitionId;

        if (!compId) {
          const map = await getSocketMap(socket.id);
          compId = map?.compId;
        }

        if (!compId) {
          const keys = await redis.keys("comp:*");
          compId = keys[0]?.replace("comp:", "");
        }

        if (!compId) {
          cb?.({ ok: false, error: "No active competition room found" });
          return;
        }

        const started = await startCompetitionNow(compId, data.countdownEnd, data.passage);
        if (!started) {
          cb?.({ ok: false, error: "Competition room not found" });
          return;
        }

        cb?.({ ok: true });
      } catch (err) {
        console.error("[countdown_start]", err);
        cb?.({ ok: false, error: "Failed to start competition" });
      }
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      const map = await getSocketMap(socket.id);
      if (!map) return;
      const room = await getComp(map.compId);
      if (room && room.players[map.userId]) {
        delete room.players[map.userId];
        await saveComp(room);
        socket.to(map.compId).emit("participant_left", {
          playerCount: Object.keys(room.players).length,
        });
      }
      await redis.del(`csock:${socket.id}`);
    });
  });
}
