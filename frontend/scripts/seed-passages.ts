/**
 * Seed the passages table with all passages from the library.
 * Run with: npx tsx scripts/seed-passages.ts
 */
import * as dotenv from "dotenv";
import path from "path";

// 1. Force environment loading BEFORE anything else loads
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { passages } from "../src/lib/db/schema";
import { ALL_PASSAGES, RawPassage } from "../src/lib/passages";

interface SeedRow {
  text: string;
  length: number;
  difficulty: "easy" | "medium" | "hard" | "code";
  author: string;
}

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL is completely missing from your environment variables.");
    process.exit(1);
  }

  console.log(`Seeding ${ALL_PASSAGES.length} passages…`);

  // 2. Open an explicit, dedicated connection using the loaded URL string
  const seedClient = postgres(connectionString, { max: 1, prepare: false });
  const seedDb = drizzle(seedClient);

  const rows = ALL_PASSAGES.map((p: RawPassage) => ({
    text:       p.content,
    length:     p.content.length,
    difficulty: p.difficulty,
    author:     p.source ?? "Unknown",
  }));

  try {
    // 3. Clear any duplicate seed lines and insert using the explicit instance
    await seedDb.delete(passages);
    await seedDb.insert(passages).values(rows).onConflictDoNothing();

    const counts = {
      easy:   rows.filter((r: SeedRow) => r.difficulty === "easy").length,
      medium: rows.filter((r: SeedRow) => r.difficulty === "medium").length,
      hard:   rows.filter((r: SeedRow) => r.difficulty === "hard").length,
      code:   rows.filter((r: SeedRow) => r.difficulty === "code").length,
    };

    console.log("✅ Seeded passages:");
    console.table(counts);
  } catch (err) {
    console.error("❌ Database insertion failed:", err);
  } finally {
    // Clean up the pool connection smoothly
    await seedClient.end();
    process.exit(0);
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});