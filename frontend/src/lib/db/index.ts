import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Prevent multiple connections in Next.js dev (hot reload)
const globalForDb = globalThis as unknown as {
  pg: ReturnType<typeof postgres>;
};

const pg = globalForDb.pg
  ?? postgres(process.env.DATABASE_URL!, { max: 10 });

if (process.env.NODE_ENV !== "production")
  globalForDb.pg = pg;

export const db = drizzle(pg, { schema });
export type DB = typeof db;