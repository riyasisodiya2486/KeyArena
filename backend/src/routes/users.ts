import type { FastifyInstance } from "fastify";

export async function userRoutes(app: FastifyInstance) {
  app.get("/", async () => ({ ok: true }));
  app.get("/me", async () => ({ ok: true }));
}