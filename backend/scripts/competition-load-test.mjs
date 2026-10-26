import { randomUUID } from "node:crypto";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import postgres from "postgres";
import { createClient } from "redis";
import { io } from "socket.io-client";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });

const backendUrl = process.env.LOAD_TEST_BACKEND_URL ?? "http://localhost:4000";
const participants = Number(process.env.LOAD_TEST_PARTICIPANTS ?? 500);
const joinAckTimeoutMs = Number(process.env.LOAD_TEST_ACK_TIMEOUT_MS ?? 30000);
const runId = randomUUID();
const competitionId = randomUUID();
const users = Array.from({ length: participants }, () => ({ id: randomUUID() }));
const capacityProbe = { id: randomUUID() };
const allUsers = [...users, capacityProbe];
const startedAt = new Date();
const sql = postgres(process.env.DATABASE_URL ?? "postgresql://keyarena:keyarena@localhost:5432/keyarena", {
  max: 12,
  connect_timeout: 5,
});
const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
const sockets = [];
const report = {
  runId,
  test: `KeyArena competition ${participants}-participant load test`,
  startedAt: startedAt.toISOString(),
  target: backendUrl,
  requestedParticipants: participants,
  host: { platform: `${os.type()} ${os.release()}`, arch: os.arch(), cpuCount: os.cpus().length },
  phases: {},
  checks: [],
  limitations: [
    "This run measures the configured local environment; production capacity depends on its server, database, Redis, network, and deployment settings.",
    "Simulated participants use separate authenticated-by-registration socket identities, not real browsers or geographically distributed networks.",
  ],
  status: "running",
};
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
let createdCompetition = false;
let createdUsers = false;
let redisConnected = false;
let socketMapsRemaining = 0;
let competitionTitle = `Load test ${runId.slice(0, 8)}`;

function assert(condition, message, details = {}) {
  report.checks.push({ name: message, passed: Boolean(condition), ...details });
  if (!condition) throw new Error(message);
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(1));
}

function parseMiB(value) {
  const match = String(value ?? "").trim().match(/^([\d.]+)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factors = { b: 1 / 1024 / 1024, kb: 1 / 1024, kib: 1 / 1024, mb: 1, mib: 1, gb: 1024, gib: 1024, tb: 1024 * 1024, tib: 1024 * 1024 };
  return Number((amount * factors[unit]).toFixed(1));
}

function makeRows(rows, width, encodeRow) {
  const params = [];
  const values = rows.map((row, rowIndex) => {
    const placeholders = Array.from({ length: width }, (_, columnIndex) => `$${rowIndex * width + columnIndex + 1}`);
    params.push(...encodeRow(row, rowIndex));
    return `(${placeholders.join(",")})`;
  });
  return { values: values.join(","), params };
}

function waitForSocket(socket, event, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for socket event ${event}`));
    }, timeoutMs);
    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

function emitAck(socket, event, payload, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) reject(timeoutError);
      else resolve(response);
    });
  });
}

async function createFixtures() {
  const passage = await sql.unsafe("SELECT id, content FROM passages WHERE difficulty = 'hard' LIMIT 1");
  const now = new Date();
  const finishAt = new Date(now.getTime() + 30 * 60 * 1000);
  await sql.unsafe(
    `INSERT INTO competitions (id,title,description,reward,start_time,end_time,passage_id,status,max_players,registered_count,scheduled_at)
     VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::uuid,'waiting',$8,0,$5)`,
    [competitionId, competitionTitle, "Temporary automated capacity verification", "Load test only", now, finishAt, passage[0]?.id ?? null, participants],
  );
  createdCompetition = true;

  const userRows = makeRows(allUsers, 4, (user, index) => [
    user.id,
    `Load test racer ${index + 1}`,
    `load-${runId}-${index}@example.invalid`,
    `load_${runId.replaceAll("-", "").slice(0, 8)}_${index}`,
  ]);
  await sql.unsafe(`INSERT INTO users (id,name,email,username) VALUES ${userRows.values}`, userRows.params);
  createdUsers = true;

  return passage[0]?.content ?? "The quick brown fox jumps over the lazy dog.";
}

async function registerAll() {
  const began = performance.now();
  const latencies = [];
  const requestConcurrency = Number(process.env.LOAD_TEST_HTTP_CONCURRENCY ?? 40);
  const responses = new Array(users.length);
  let nextUser = 0;
  const registrationWorkers = Array.from({ length: Math.min(requestConcurrency, users.length) }, async () => {
    while (true) {
      const index = nextUser++;
      if (index >= users.length) return;
      const started = performance.now();
      try {
        const response = await fetch(`${backendUrl}/api/compete/${competitionId}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: users[index].id }),
          signal: AbortSignal.timeout(45000),
        });
        latencies.push(performance.now() - started);
        responses[index] = { status: response.status, body: await response.json().catch(() => ({})) };
      } catch (error) {
        responses[index] = { status: 0, body: {}, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  await Promise.all(registrationWorkers);
  const succeeded = responses.filter((response) => response.status === 200 && response.body.ok).length;
  const overflow = await fetch(`${backendUrl}/api/compete/${competitionId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: capacityProbe.id }),
    signal: AbortSignal.timeout(15000),
  });
  const registrationCount = await sql.unsafe(
    "SELECT count(*)::int AS count FROM competition_registrations WHERE competition_id=$1::uuid",
    [competitionId],
  );
  report.phases.registration = {
    durationMs: Number((performance.now() - began).toFixed(1)),
    requestConcurrency,
    succeeded,
    failed: participants - succeeded,
    requestErrors: responses.filter((response) => response.error).slice(0, 5).map((response) => response.error),
    countInDatabase: registrationCount[0].count,
    p50Ms: percentile(latencies, 0.50),
    p95Ms: percentile(latencies, 0.95),
    fullEventResponse: overflow.status,
  };
  assert(succeeded === participants, "Every simulated racer registered through the competition API", report.phases.registration);
  assert(registrationCount[0].count === participants, "Registration database count matches the simulated field", report.phases.registration);
  assert(overflow.status === 409, "Registration API rejects an extra racer when the competition is full", report.phases.registration);
}

async function seedRoom(passageText) {
  const dbRoom = {
    competitionId,
    passageText,
    status: "waiting",
    players: {},
    startTime: null,
    finishOrder: [],
    maxPlayers: participants,
  };
  await redis.setEx(`comp:${competitionId}`, 7200, JSON.stringify(dbRoom));
  return dbRoom.passageText;
}

async function connectAll() {
  const connectLatencies = [];
  const began = performance.now();
  await Promise.all(users.map((user, index) => new Promise((resolve, reject) => {
    const socket = io(`${backendUrl}/compete`, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 20000,
      forceNew: true,
    });
    sockets[index] = socket;
    const started = performance.now();
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Socket ${index + 1} connection timed out`));
    }, 25000);
    socket.once("connect", () => {
      clearTimeout(timer);
      connectLatencies.push(performance.now() - started);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  })));
  report.phases.socketConnect = {
    durationMs: Number((performance.now() - began).toFixed(1)),
    connected: sockets.filter((socket) => socket?.connected).length,
    p50Ms: percentile(connectLatencies, 0.50),
    p95Ms: percentile(connectLatencies, 0.95),
    maxMs: Number(Math.max(...connectLatencies).toFixed(1)),
  };
  assert(report.phases.socketConnect.connected === participants, "All simulated socket clients connected", report.phases.socketConnect);
}

async function joinAll() {
  const began = performance.now();
  const joinLatencies = [];
  const updatesSeen = sockets.map(() => 0);
  sockets.forEach((socket, index) => socket.on("comp_leaderboard_update", () => { updatesSeen[index] += 1; }));

  const results = await Promise.all(sockets.map(async (socket, index) => {
    const started = performance.now();
    const response = await emitAck(socket, "join_competition", {
      competitionId,
      userId: users[index].id,
      username: `load_${String(index + 1).padStart(3, "0")}`,
      name: `Load racer ${index + 1}`,
      image: null,
    }, joinAckTimeoutMs);
    joinLatencies.push(performance.now() - started);
    return response;
  }).map((attempt) => attempt.catch((error) => ({ ok: false, error: error.message }))));
  const successfulAcks = results.filter((result) => result?.ok).length;
  const roomRaw = await redis.get(`comp:${competitionId}`);
  const room = roomRaw ? JSON.parse(roomRaw) : null;
  report.phases.join = {
    durationMs: Number((performance.now() - began).toFixed(1)),
    successfulAcks,
    failedAcks: participants - successfulAcks,
    serverJoinErrors: results.filter((result) => result?.error).slice(0, 5).map((result) => result.error),
    registeredPlayersInRedis: Object.keys(room?.players ?? {}).length,
    p50AckMs: percentile(joinLatencies, 0.50),
    p95AckMs: percentile(joinLatencies, 0.95),
    maxAckMs: Number(Math.max(...joinLatencies).toFixed(1)),
  };
  assert(successfulAcks === participants, "Every registered racer received a successful join acknowledgement", report.phases.join);
  assert(report.phases.join.registeredPlayersInRedis === participants, "Redis room retained every joined racer", report.phases.join);
  report._updatesSeen = updatesSeen;
  console.log(`Join phase: ${successfulAcks}/${participants} acknowledgements; ${report.phases.join.registeredPlayersInRedis} racers in Redis.`);
}

async function startAndRace(passageText) {
  const countdownEvents = sockets.map((socket) => waitForSocket(socket, "countdown_start"));
  const raceStartEvents = sockets.map((socket) => waitForSocket(socket, "race_start", 45000));
  const countdownEnd = Date.now() + 2500;
  const began = performance.now();
  await redis.publish("competition:start", JSON.stringify({ competitionId, countdownEnd, passage: passageText }));
  const countdownResults = await Promise.all(countdownEvents);
  const countdownDurationMs = performance.now() - began;
  await Promise.all(raceStartEvents);
  report.phases.start = {
    countdownRecipients: countdownResults.length,
    raceStartRecipients: participants,
    countdownBroadcastMs: Number(countdownDurationMs.toFixed(1)),
  };
  assert(countdownResults.length === participants, "Every racer received the countdown event", report.phases.start);
  assert(report.phases.start.raceStartRecipients === participants, "Every racer received the race-start event", report.phases.start);
  console.log(`Start phase: countdown and race-start reached ${participants} clients.`);

  const beganProgress = performance.now();
  const receivedProgressUpdates = sockets.map((socket, index) => new Promise((resolve) => {
    if (report._updatesSeen[index] > 0) return resolve(performance.now());
    const timer = setTimeout(() => resolve(null), 30000);
    socket.on("comp_leaderboard_update", function onUpdate() {
      socket.off("comp_leaderboard_update", onUpdate);
      clearTimeout(timer);
      resolve(performance.now());
    });
  }));
  await Promise.all(sockets.map((socket, index) => socket.emit("comp_progress", {
    competitionId,
    userId: users[index].id,
    progress: 10 + (index % 90),
    wpm: 40 + (index % 120),
    accuracy: 92 + (index % 9),
  })));
  const deliveredAt = await Promise.all(receivedProgressUpdates);
  const liveBoard = await fetch(`${backendUrl}/api/compete/${competitionId}/leaderboard?limit=100`).then((response) => response.json());
  const progressRecipients = deliveredAt.filter(Boolean).length;
  report.phases.progress = {
    sent: participants,
    clientsReceivingLeaderboardUpdate: progressRecipients,
    durationMs: Number((performance.now() - beganProgress).toFixed(1)),
    firstUpdateLatencyMs: deliveredAt.filter(Boolean).length
      ? Number((Math.min(...deliveredAt.filter(Boolean)) - beganProgress).toFixed(1))
      : null,
    leaderboardTotal: liveBoard.total,
    leaderboardEntriesReturned: liveBoard.entries?.length ?? 0,
  };
  assert(progressRecipients === participants, "All connected racers received live leaderboard updates", report.phases.progress);
  assert(liveBoard.total === participants, "Live leaderboard includes every racer who reported progress", report.phases.progress);
  console.log(`Progress phase: live board contains ${liveBoard.total} racers; all clients received an update.`);

  const beganFinish = performance.now();
  const finalEvents = sockets.map((socket) => waitForSocket(socket, "competition_finished", 60000));
  const finishAttempts = await Promise.allSettled(sockets.map((socket, index) => emitAck(socket, "comp_finished", {
    competitionId,
    userId: users[index].id,
    wpm: 40 + (index % 120),
    rawWpm: 44 + (index % 120),
    accuracy: 92 + (index % 9),
    timeTakenMs: 60000 + index,
    keystrokeLog: [],
  }, 60000)));
  const finishResponses = finishAttempts.flatMap((attempt) => attempt.status === "fulfilled" ? [attempt.value] : []);
  const finalEventAttempts = await Promise.allSettled(finalEvents);
  const finalBoards = finalEventAttempts.flatMap((attempt) => attempt.status === "fulfilled" ? [attempt.value] : []);
  const finalBoard = await fetch(`${backendUrl}/api/compete/${competitionId}/leaderboard?limit=100`).then((response) => response.json());
  const ordered = (finalBoard.entries ?? []).every((entry, index, entries) => index === 0 || entries[index - 1].wpm >= entry.wpm);
  const failedFinishes = finishResponses.filter((response) => !response?.ok).length;
  const finalStatuses = await sql.unsafe("SELECT status FROM competitions WHERE id=$1::uuid", [competitionId]);
  const savedSessions = await sql.unsafe("SELECT count(*)::int AS count FROM race_sessions WHERE competition_id=$1::uuid", [competitionId]);
  report.phases.finish = {
    durationMs: Number((performance.now() - beganFinish).toFixed(1)),
    acknowledged: finishResponses.filter((response) => response?.ok).length,
    failed: participants - finishResponses.filter((response) => response?.ok).length,
    finalLeaderboardEventsReceived: finalBoards.length,
    missingFinalLeaderboardEvents: participants - finalBoards.length,
    finalLeaderboardTotal: finalBoard.total,
    finalLeaderboardEntriesReturned: finalBoard.entries?.length ?? 0,
    topHundredOrderedByWpm: ordered,
    savedRaceSessions: savedSessions[0].count,
    competitionStatus: finalStatuses[0]?.status,
  };
  assert(failedFinishes === 0 && finishResponses.length === participants, "Every racer finish was accepted", report.phases.finish);
  assert(finalBoards.length === participants, "Every connected racer received the final leaderboard event", report.phases.finish);
  assert(finalBoard.total === participants, "Final leaderboard contains all finished racers", report.phases.finish);
  assert(ordered && (finalBoard.entries?.length ?? 0) === Math.min(100, participants), "Leaderboard endpoint returns the top racers in WPM order", report.phases.finish);
  assert(savedSessions[0].count === participants, "A race result was saved for every racer", report.phases.finish);
  assert(finalStatuses[0]?.status === "finished", "Competition status changed to finished", report.phases.finish);
}

async function writeReport(error = null) {
  report.finishedAt = new Date().toISOString();
  report.durationMs = Number((Date.parse(report.finishedAt) - startedAt.getTime()).toFixed(1));
  report.eventLoopDelayMs = {
    p50: Number((eventLoop.percentile(50) / 1e6).toFixed(2)),
    p95: Number((eventLoop.percentile(95) / 1e6).toFixed(2)),
    max: Number((eventLoop.max / 1e6).toFixed(2)),
  };
  report.cleanup = report.cleanup ?? { verified: false, reason: "Cleanup verification did not complete." };
  report.status = error ? "failed" : "passed";
  if (error) report.error = error instanceof Error ? error.stack ?? error.message : String(error);
  delete report._updatesSeen;

  const evidenceDir = path.join(root, "evidence", "competition-load");
  await fs.mkdir(evidenceDir, { recursive: true });
  const stamp = startedAt.toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const jsonPath = path.join(evidenceDir, `${stamp}-${runId.slice(0, 8)}.json`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    `# Competition load test - ${report.status.toUpperCase()}`,
    "",
    `- Run: \`${runId}\``,
    `- Started: ${report.startedAt}`,
    `- Target: \`${backendUrl}\``,
    `- Simulated participants: ${participants}`,
    `- Overall duration: ${report.durationMs} ms`,
    "",
    "## Phase evidence",
    "",
    ...Object.entries(report.phases).map(([name, values]) => `- **${name}:** ${JSON.stringify(values)}`),
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.passed ? "PASS" : "FAIL"} - ${check.name}`),
    "",
    "## Cleanup verification",
    "",
    JSON.stringify(report.cleanup),
    "",
    `Backend process sample: ${JSON.stringify(report.backendProcess ?? { available: false })}`,
    "",
    `Test runner event-loop delay p95/max: ${report.eventLoopDelayMs.p95}/${report.eventLoopDelayMs.max} ms. This is the client load-generator process, not the backend process.`,
    "",
    "## Scope and limits",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
    error ? `Failure: ${error instanceof Error ? error.message : String(error)}` : "No test failure recorded.",
    "",
    `Full machine-readable report: \`${path.basename(jsonPath)}\``,
    "",
  ].join("\n");
  await fs.writeFile(jsonPath.replace(/\.json$/, ".md"), markdown);
  console.log(`Evidence saved: ${jsonPath}`);
  console.log(`Evidence saved: ${jsonPath.replace(/\.json$/, ".md")}`);
}

let failure = null;
let backendSampler = null;
let backendSamplerError = null;
eventLoop.enable();
try {
  const parsedUrl = new URL(backendUrl);
  if (!participants || participants < 2 || participants > 1000 || !Number.isInteger(participants)) {
    throw new Error("LOAD_TEST_PARTICIPANTS must be an integer from 2 to 1000");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)) {
    throw new Error("Safety stop: this script only targets a local backend. Set LOAD_TEST_BACKEND_URL to localhost.");
  }
  const health = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(5000) });
  assert(health.ok, "Backend health endpoint is reachable", { status: health.status });
  if (process.platform === "win32") {
    const port = Number(parsedUrl.port || 4000);
    const dockerContainer = process.env.LOAD_TEST_DOCKER_CONTAINER;
    if (dockerContainer && !/^[a-zA-Z0-9_.-]+$/.test(dockerContainer)) {
      throw new Error("LOAD_TEST_DOCKER_CONTAINER contains unsupported characters");
    }
    const command = dockerContainer
      ? `$container='${dockerContainer}'; while ($true) { try { $line=docker stats --no-stream --format '{{json .}}' $container 2>$null; if ($LASTEXITCODE -eq 0 -and $line) { [Console]::Out.WriteLine([string]$line) } } catch {}; Start-Sleep -Milliseconds 1000 }`
      : `$port=${port}; while ($true) { try { $c=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $p=Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; if ($p) { [Console]::Out.WriteLine((@{pid=$p.Id;cpuSeconds=$p.CPU;workingSetBytes=$p.WorkingSet64} | ConvertTo-Json -Compress)) } } } catch {}; Start-Sleep -Milliseconds 1000 }`;
    backendSampler = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    backendSampler.on("error", (error) => { backendSamplerError = error.message; });
    const backendSamples = [];
    let resolveFirstSample;
    const firstSample = new Promise((resolve) => { resolveFirstSample = resolve; });
    let pendingLine = "";
    backendSampler.stdout.setEncoding("utf8");
    backendSampler.stdout.on("data", (chunk) => {
      pendingLine += chunk;
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const sample = JSON.parse(line);
          if (sample.CPUPerc) {
            const [usedMemory, totalMemory] = String(sample.MemUsage ?? "").split("/").map((part) => part.trim());
            backendSamples.push({
              cpuPercent: Number.parseFloat(sample.CPUPerc),
              memoryUsedMiB: parseMiB(usedMemory),
              memoryLimitMiB: parseMiB(totalMemory),
              memoryPercent: Number.parseFloat(sample.MemPerc),
            });
          } else {
            backendSamples.push(sample);
          }
          resolveFirstSample();
        } catch {}
      }
    });
    report.backendProcessSamples = backendSamples;
    await Promise.race([firstSample, new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
  await redis.connect();
  redisConnected = true;
  await sql`SELECT 1`;

  const passageText = await createFixtures();
  await registerAll();
  await seedRoom(passageText);
  await connectAll();
  await joinAll();
  await startAndRace(passageText);
} catch (error) {
  failure = error;
  console.error("Load test failed:", error);
} finally {
  const socketMapKeys = sockets.map((socket) => socket?.id).filter(Boolean).map((socketId) => `csock:${socketId}`);
  for (const socket of sockets) socket?.disconnect();
  if (redisConnected) {
    const disconnectDeadline = Date.now() + 15000;
    do {
      const mapped = await Promise.all(socketMapKeys.map((key) => redis.exists(key)));
      socketMapsRemaining = mapped.reduce((sum, count) => sum + count, 0);
      if (socketMapsRemaining === 0 || Date.now() >= disconnectDeadline) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (true);
  }
  if (redisConnected) {
    await redis.del([
      `comp:${competitionId}`,
      `comp_lb:${competitionId}`,
      `comp_finished:${competitionId}`,
      `comp_final:${competitionId}`,
    ]).catch(() => {});
    for (const key of ["lb:alltime", "lb:weekly", "lb:daily"]) {
      await redis.zRem(key, users.map((user) => user.id)).catch(() => {});
    }
  }
  if (createdCompetition) {
    await sql.unsafe("DELETE FROM race_sessions WHERE competition_id=$1::uuid", [competitionId]).catch(() => {});
    await sql.unsafe("DELETE FROM competition_registrations WHERE competition_id=$1::uuid", [competitionId]).catch(() => {});
    await sql.unsafe("DELETE FROM competitions WHERE id=$1::uuid", [competitionId]).catch(() => {});
  }
  if (createdUsers) {
    const ids = allUsers.map((user) => user.id);
    await sql.unsafe("DELETE FROM users WHERE id = ANY($1::uuid[])", [ids]).catch(() => {});
  }
  if (redisConnected) {
    try {
      const [competitionRows, userRows, registrationRows, sessionRows] = await Promise.all([
        sql.unsafe("SELECT count(*)::int AS count FROM competitions WHERE id=$1::uuid", [competitionId]),
        sql.unsafe("SELECT count(*)::int AS count FROM users WHERE email LIKE $1", [`load-${runId}-%@example.invalid`]),
        sql.unsafe("SELECT count(*)::int AS count FROM competition_registrations WHERE competition_id=$1::uuid", [competitionId]),
        sql.unsafe("SELECT count(*)::int AS count FROM race_sessions WHERE competition_id=$1::uuid", [competitionId]),
      ]);
      const testRedisKeys = await Promise.all([
        `comp:${competitionId}`,
        `comp_lb:${competitionId}`,
        `comp_finished:${competitionId}`,
        `comp_final:${competitionId}`,
      ].map((key) => redis.exists(key)));
      const globalLeaderboardEntries = await Promise.all(["lb:alltime", "lb:weekly", "lb:daily"].map((key) =>
        Promise.all(users.map((user) => redis.zScore(key, user.id))).then((scores) => scores.filter((score) => score !== null).length),
      ));
      report.cleanup = {
        verified: true,
        temporaryCompetitionsRemaining: competitionRows[0].count,
        temporaryUsersRemaining: userRows[0].count,
        temporaryRegistrationsRemaining: registrationRows[0].count,
        temporaryRaceSessionsRemaining: sessionRows[0].count,
        temporarySocketMapsRemaining: socketMapsRemaining,
        temporaryRedisKeysRemaining: testRedisKeys.reduce((sum, count) => sum + count, 0),
        temporaryGlobalLeaderboardEntriesRemaining: globalLeaderboardEntries.reduce((sum, count) => sum + count, 0),
      };
      const clean = Object.entries(report.cleanup).every(([key, value]) => key === "verified" || value === 0);
      report.checks.push({ name: "Temporary test records and scores were removed", passed: clean, ...report.cleanup });
      if (!clean && !failure) failure = new Error("Temporary test data was not fully removed");
    } catch (error) {
      report.cleanup = { verified: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }
  if (redisConnected) await redis.quit().catch(() => {});
  if (backendSampler && !backendSamplerError && !backendSampler.killed) {
    backendSampler.kill();
    await new Promise((resolve) => backendSampler.once("close", resolve));
  }
  if (backendSampler) {
    const samples = report.backendProcessSamples ?? [];
    const dockerSamples = samples.filter((sample) => Number.isFinite(sample.cpuPercent));
    const cpuSecondsUsed = samples.length > 1 && Number.isFinite(samples[0].cpuSeconds)
      ? Number((samples.at(-1).cpuSeconds - samples[0].cpuSeconds).toFixed(2))
      : null;
    report.backendProcess = dockerSamples.length ? {
      source: "docker stats",
      container: process.env.LOAD_TEST_DOCKER_CONTAINER,
      samples: dockerSamples.length,
      averageCpuPercent: Number((dockerSamples.reduce((sum, sample) => sum + sample.cpuPercent, 0) / dockerSamples.length).toFixed(1)),
      peakCpuPercent: Number(Math.max(...dockerSamples.map((sample) => sample.cpuPercent)).toFixed(1)),
      peakMemoryMiB: Math.max(...dockerSamples.map((sample) => sample.memoryUsedMiB ?? 0)),
      finalMemoryMiB: dockerSamples.at(-1).memoryUsedMiB,
      memoryLimitMiB: dockerSamples.at(-1).memoryLimitMiB,
    } : samples.length ? {
      pid: samples[0].pid,
      samples: samples.length,
      cpuSecondsStart: samples[0].cpuSeconds,
      cpuSecondsEnd: samples.at(-1).cpuSeconds,
      cpuSecondsUsed,
      averageCpuPercentOfOneCore: cpuSecondsUsed === null ? null : Number((cpuSecondsUsed / ((Date.now() - startedAt.getTime()) / 1000) * 100).toFixed(1)),
      workingSetPeakMiB: Number((Math.max(...samples.map((sample) => sample.workingSetBytes)) / 1024 / 1024).toFixed(1)),
      workingSetFinalMiB: Number((samples.at(-1).workingSetBytes / 1024 / 1024).toFixed(1)),
    } : { available: false, reason: backendSamplerError ?? "Could not read the backend listener process from Windows process counters." };
    delete report.backendProcessSamples;
  }
  await sql.end({ timeout: 5 }).catch(() => {});
  eventLoop.disable();
  await writeReport(failure);
}

if (failure) process.exitCode = 1;
