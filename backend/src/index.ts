import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { userRoutes }        from "./routes/users.js";
import { raceRoutes }        from "./routes/races.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { registerRaceSocket } from "./sockets/race.js";

const PORT = Number(process.env.PORT ?? 4000);

const app = Fastify({ logger: true });

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
});
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

await app.register(userRoutes,        { prefix: "/api/users" });
await app.register(raceRoutes,        { prefix: "/api/races" });
await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });

app.get("/health", async () =>
  ({ status: "ok", ts: Date.now() }));

// Socket.io with Redis adapter (horizontal scale ready)
const httpServer = createServer(app.server);
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

const io = new SocketServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  adapter: createAdapter(pubClient, subClient),
});
registerRaceSocket(io);

await app.ready();
httpServer.listen({ port: PORT, host: "0.0.0.0" }, () =>
  console.log(` Backend on http://localhost:${PORT}`));