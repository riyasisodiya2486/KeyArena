import "dotenv/config";
import Fastify from "fastify";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

import { userRoutes }        from "./routes/users.js";
import { raceRoutes }        from "./routes/races.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { roomRoutes }        from "./routes/rooms.js";
import { registerRaceSocket } from "./sockets/race.js";

const PORT   = Number(process.env.PORT ?? 4000);
const IS_DEV = process.env.NODE_ENV !== "production";

const app = Fastify({ logger: IS_DEV });

await app.register(userRoutes,        { prefix: "/api/users" });
await app.register(raceRoutes,        { prefix: "/api/races" });
await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
await app.register(roomRoutes,        { prefix: "/api/rooms" });

app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

// ─── Socket.io + Redis adapter (horizontal scale ready) ──────────────────────
const httpServer = app.server;

const pubClient = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

const io = new SocketServer(httpServer, {
  cors:    { origin: process.env.FRONTEND_URL ?? "http://localhost:3000", credentials: true },
  adapter: createAdapter(pubClient, subClient),
  // Tune for competition scale
  pingTimeout:  20000,
  pingInterval: 10000,
});

registerRaceSocket(io);

try {
  await app.ready();
  httpServer.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`🚀 KeyRace backend on http://0.0.0.0:${PORT}`);
  });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
