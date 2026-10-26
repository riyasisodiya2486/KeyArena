import type { Server, Socket } from "socket.io";
import { redis } from "../lib/redis.js";
import { db } from "../lib/db.js";
import { competitions, competitionRegistrations, raceSessions, passages } from "../lib/schema.js";
import type { KeystrokeEvent } from "../lib/schema.js";
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
  countdownEnd?: number | null;
  players:       Record<string, CompetitionPlayer>;
  startTime:     number | null;
  finishOrder:   string[];
  maxPlayers:    number; // can be 500+
}

const TTL = 7200; // 2 hours

// Joining is a read/modify/write operation on a shared room. Keep it inside a
// single Redis command so simultaneous participants cannot overwrite each other.
const JOIN_COMPETITION_SCRIPT = `
local key = KEYS[1]
local roomJson = redis.call('GET', key)
if not roomJson then
  roomJson = ARGV[1]
end
local room = cjson.decode(roomJson)
if room.status == 'finished' then
  return { 'finished', roomJson, '0' }
end
if not room.players then room.players = {} end
local userId = ARGV[2]
local isNewPlayer = room.players[userId] == nil
local playerCount = 0
for _ in pairs(room.players) do playerCount = playerCount + 1 end
if isNewPlayer and playerCount >= tonumber(room.maxPlayers) then
  return { 'full', roomJson, tostring(playerCount) }
end
room.players[userId] = cjson.decode(ARGV[3])
playerCount = playerCount + (isNewPlayer and 1 or 0)
roomJson = cjson.encode(room)
redis.call('SET', key, roomJson, 'EX', tonumber(ARGV[4]))
return { 'ok', tostring(playerCount), room.status, room.passageText, tostring(room.countdownEnd or ''), tostring(room.startTime or ''), tostring(room.maxPlayers) }
`;

const UPDATE_COMPETITION_PROGRESS_SCRIPT = `
local key = KEYS[1]
local roomJson = redis.call('GET', key)
if not roomJson then return false end
local room = cjson.decode(roomJson)
if room.status ~= 'racing' or not room.players or not room.players[ARGV[1]] then return false end
local player = room.players[ARGV[1]]
player.progress = tonumber(ARGV[2])
player.wpm = tonumber(ARGV[3])
player.accuracy = tonumber(ARGV[4])
room.players[ARGV[1]] = player
roomJson = cjson.encode(room)
redis.call('SET', key, roomJson, 'EX', tonumber(ARGV[5]))
return roomJson
`;

const FINISH_COMPETITION_PLAYER_SCRIPT = `
local roomKey = KEYS[1]
local leaderboardKey = KEYS[2]
local finishedKey = KEYS[3]
local roomJson = redis.call('GET', roomKey)
if not roomJson then return { 'missing_room' } end
local room = cjson.decode(roomJson)
if room.status ~= 'racing' then return { 'not_racing' } end
local userId = ARGV[1]
if not room.players or not room.players[userId] then return { 'not_joined' } end
local player = room.players[userId]
if player.finished then return { 'already_finished' } end
player.finished = true
player.finishTime = tonumber(ARGV[3])
player.wpm = tonumber(ARGV[2])
local score = tonumber(ARGV[2]) * 100
redis.call('ZADD', leaderboardKey, score, userId)
player.rank = redis.call('ZREVRANK', leaderboardKey, userId) + 1
room.players[userId] = player
if not room.finishOrder then room.finishOrder = {} end
table.insert(room.finishOrder, userId)
redis.call('SADD', finishedKey, userId)
redis.call('EXPIRE', finishedKey, tonumber(ARGV[4]))
local playerCount = 0
for _ in pairs(room.players) do playerCount = playerCount + 1 end
local finishedCount = redis.call('SCARD', finishedKey)
local isFinished = playerCount > 0 and finishedCount >= playerCount
if isFinished then room.status = 'finished' end
roomJson = cjson.encode(room)
redis.call('SET', roomKey, roomJson, 'EX', tonumber(ARGV[4]))
return { 'ok', roomJson, tostring(player.rank), tostring(playerCount), tostring(finishedCount), isFinished and '1' or '0' }
`;

const REMOVE_COMPETITION_PLAYER_SCRIPT = `
local key = KEYS[1]
local roomJson = redis.call('GET', key)
if not roomJson then return { '0', '0' } end
local room = cjson.decode(roomJson)
if room.players and room.players[ARGV[1]] then
  room.players[ARGV[1]] = nil
  local playerCount = 0
  for _ in pairs(room.players) do playerCount = playerCount + 1 end
  roomJson = cjson.encode(room)
  redis.call('SET', key, roomJson, 'EX', tonumber(ARGV[2]))
  return { '1', tostring(playerCount) }
end
return { '0', tostring(room.players and #room.players or 0) }
`;

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
function compFinishedKey(id: string) { return `comp_finished:${id}`; }
function compFinalKey(id: string) { return `comp_final:${id}`; }

export function registerCompetitionSocket(io: Server) {
  // Competition namespace for isolation
  const ns = io.of("/compete");
  const progressBroadcasts = new Map<string, { timer: NodeJS.Timeout | null; lastBroadcastAt: number; dirty: boolean }>();

  function scheduleProgressBroadcast(competitionId: string) {
    let state = progressBroadcasts.get(competitionId);
    if (!state) {
      state = { timer: null, lastBroadcastAt: 0, dirty: false };
      progressBroadcasts.set(competitionId, state);
    }
    state.dirty = true;
    if (state.timer) return;

    const delay = Math.max(0, 150 - (Date.now() - state.lastBroadcastAt));
    state.timer = setTimeout(async () => {
      state!.timer = null;
      if (!state!.dirty) return;
      state!.dirty = false;
      state!.lastBroadcastAt = Date.now();
      try {
        const room = await getComp(competitionId);
        if (!room || room.status !== "racing") return;
        const topEntries = await redis.zRangeWithScores(compLbKey(competitionId), 0, 24, { REV: true });
        ns.to(competitionId).emit("comp_leaderboard_update", {
          top25: topEntries.map((entry, index) => ({
            rank: index + 1,
            userId: entry.value,
            username: room.players[entry.value]?.username ?? `racer_${index + 1}`,
            wpm: Math.round(entry.score / 100),
          })),
          totalPlayers: Object.keys(room.players).length,
        });
      } catch (error) {
        console.error("[comp_progress_broadcast]", error);
      }
      if (state!.dirty) scheduleProgressBroadcast(competitionId);
    }, delay);
  }

  async function emitFinalLeaderboard(competitionId: string, room: CompetitionRoom) {
    const claimed = await redis.set(compFinalKey(competitionId), "1", { NX: true, EX: TTL });
    if (!claimed) return;
    const top = await redis.zRangeWithScores(compLbKey(competitionId), 0, 24, { REV: true });
    ns.to(competitionId).emit("competition_finished", {
      top25: top.map((entry, index) => ({
        rank: index + 1,
        userId: entry.value,
        username: room.players[entry.value]?.username ?? `racer_${index + 1}`,
        wpm: Math.round(entry.score / 100),
      })),
      totalPlayers: Object.keys(room.players).length,
    });
  }

  async function startCompetitionNow(
    competitionId: string,
    countdownEnd?: number,
    passageOverride?: string,
  ) {
    let room = await getComp(competitionId);
    if (!room) {
      const competition = await db.query.competitions.findFirst({
        where: eq(competitions.id, competitionId),
      });
      if (!competition) return false;
      const passage = competition.passageId
        ? await db.query.passages.findFirst({ where: eq(passages.id, competition.passageId) })
        : null;
      room = {
        competitionId,
        passageText: passage?.content ?? "The quick brown fox jumps over the lazy dog.",
        status: "waiting",
        players: {},
        startTime: null,
        finishOrder: [],
        maxPlayers: competition.maxPlayers ?? 500,
      };
    }
    if (room.status === "finished") return false;

    if (passageOverride?.trim()) {
      room.passageText = passageOverride.trim();
    }

    const endTs = Math.max(Date.now() + 1000, countdownEnd ?? Date.now() + 3000);
    room.status = "countdown";
    room.countdownEnd = endTs;
    await saveComp(room);

    ns.to(competitionId).emit("countdown_start", {
      countdownEnd: endTs,
      passage: room.passageText,
    });

    const delay = Math.max(0, endTs - Date.now());
    setTimeout(async () => {
      const latest = await getComp(competitionId);
      if (!latest || latest.status !== "countdown") return;
      latest.status = "racing";
      latest.countdownEnd = null;
      latest.startTime = Date.now();
      await saveComp(latest);
      ns.to(competitionId).emit("race_start");
    }, delay);

    return true;
  }

  async function finishCompetitionNow(competitionId: string) {
    const room = await getComp(competitionId);
    if (!room) return false;
    room.status = "finished";
    await saveComp(room);
    await emitFinalLeaderboard(competitionId, room);
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

        let initialRoom: CompetitionRoom | null = null;

        // Only load the passage and competition metadata if no room exists.
        // Reading and parsing the full room for every join makes a 500-person
        // join burst quadratic in Redis payload and application work.
        const roomExists = await redis.exists(`comp:${data.competitionId}`);
        if (!roomExists) {
          const comp = await db.query.competitions.findFirst({
            where: eq(competitions.id, data.competitionId),
          });
          if (!comp) return cb({ ok: false, error: "Competition not found" });

          const passage = await db.query.passages.findFirst({
            where: eq(passages.id, comp.passageId!),
          }) ?? { content: "The quick brown fox jumps over the lazy dog." };

          initialRoom = {
            competitionId: data.competitionId,
            passageText:   passage.content,
            status:        "waiting",
            players:       {},
            startTime:     null,
            finishOrder:   [],
            maxPlayers:    comp.maxPlayers ?? 500,
          };
        }

        const player: CompetitionPlayer = {
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

        const joined = await redis.eval(JOIN_COMPETITION_SCRIPT, {
          keys: [`comp:${data.competitionId}`],
          arguments: [
            JSON.stringify(initialRoom ?? {
              competitionId: data.competitionId,
              passageText: "The quick brown fox jumps over the lazy dog.",
              status: "waiting",
              players: {},
              startTime: null,
              finishOrder: [],
              maxPlayers: 500,
            }),
            data.userId,
            JSON.stringify(player),
            String(TTL),
          ],
        }) as string[];
        if (joined[0] === "finished") return cb({ ok: false, error: "This competition has finished" });
        if (joined[0] === "full") return cb({ ok: false, error: "This competition is full" });
        await saveSocketMap(socket.id, data.userId, data.competitionId);

        socket.join(data.competitionId);

        const playerCount = Number(joined[1]);
        const responseRoom: CompetitionRoom = {
          competitionId: data.competitionId,
          passageText: joined[3],
          status: joined[2] as CompetitionRoom["status"],
          countdownEnd: joined[4] ? Number(joined[4]) : null,
          startTime: joined[5] ? Number(joined[5]) : null,
          finishOrder: [],
          maxPlayers: Number(joined[6]) || initialRoom?.maxPlayers || 500,
          players: { [data.userId]: player },
        };

        // Broadcast new participant count (lightweight — not full room state)
        socket.to(data.competitionId).emit("participant_joined", { playerCount });

        cb({ ok: true, room: responseRoom, playerCount });
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
        const roomJson = await redis.eval(UPDATE_COMPETITION_PROGRESS_SCRIPT, {
          keys: [`comp:${data.competitionId}`],
          arguments: [data.userId, String(data.progress), String(data.wpm), String(data.accuracy), String(TTL)],
        });
        if (typeof roomJson !== "string") return;
        await redis.zAdd(compLbKey(data.competitionId), {
          score: data.wpm * 100,
          value: data.userId,
        });
        scheduleProgressBroadcast(data.competitionId);
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
      keystrokeLog?: KeystrokeEvent[];
    }, cb: (res: { ok: boolean; rank?: number; error?: string }) => void) => {
      try {
        const result = await redis.eval(FINISH_COMPETITION_PLAYER_SCRIPT, {
          keys: [
            `comp:${data.competitionId}`,
            compLbKey(data.competitionId),
            compFinishedKey(data.competitionId),
          ],
          arguments: [data.userId, String(data.wpm), String(Date.now()), String(TTL)],
        }) as string[];
        if (result[0] !== "ok") {
          const error = result[0] === "already_finished"
            ? "Already finished"
            : result[0] === "not_joined"
            ? "Not in competition"
            : result[0] === "missing_room"
            ? "Competition room not found"
            : "Not racing";
          return cb({ ok: false, error });
        }
        const room = JSON.parse(result[1]) as CompetitionRoom;
        const rank = Number(result[2]);
        const everyoneFinished = result[5] === "1";

        // Save race session
        await db.insert(raceSessions).values({
          userId:       data.userId,
          mode:         "competition",
          competitionId: data.competitionId,
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

        if (everyoneFinished) {
          await db.update(competitions)
            .set({ status: "finished", finishedAt: new Date() })
            .where(eq(competitions.id, data.competitionId));
          await emitFinalLeaderboard(data.competitionId, room);
        } else {
          scheduleProgressBroadcast(data.competitionId);
        }

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
      const result = await redis.eval(REMOVE_COMPETITION_PLAYER_SCRIPT, {
        keys: [`comp:${map.compId}`],
        arguments: [map.userId, String(TTL)],
      }) as string[];
      if (result[0] === "1") {
        socket.to(map.compId).emit("participant_left", {
          playerCount: Number(result[1]),
        });
      }
      await redis.del(`csock:${socket.id}`);
    });
  });

  return { startCompetitionNow, finishCompetitionNow };
}
