import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { raceSessions } from "@/lib/db/schema";
import { submitScore } from "@/lib/redis";
import { z } from "zod";

const SaveSchema = z.object({
  mode:         z.enum(["solo", "multiplayer", "competition"]).default("solo"),
  difficulty:   z.enum(["easy", "medium", "hard", "code"]).default("medium"),
  wpm:          z.number().min(0).max(300),
  rawWpm:       z.number().min(0).max(300),
  accuracy:     z.number().min(0).max(100),
  charsTyped:   z.number().int().min(0),
  errorsCount:  z.number().int().min(0),
  timeTakenMs:  z.number().int().min(0),
  keystrokeLog: z.array(z.object({
    char:      z.string(),
    expected:  z.string(),
    timestamp: z.number(),
    correct:   z.boolean(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body   = await req.json();
  const parsed = SaveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Insert ONLY the columns that exist in your schema.ts layout
  const [raceSession] = await db
    .insert(raceSessions)
    .values({
      userId:       session.user.id,
      mode:         data.mode,
      difficulty:   data.difficulty,
      wpm:          data.wpm,
      accuracy:     data.accuracy,
      timeTakenMs:  data.timeTakenMs,
      keystrokeLog: data.keystrokeLog ?? [],
      completedAt:  new Date(),
    })
    .returning();

  // Update Redis leaderboards using the processed WPM metric
  await submitScore(session.user.id, data.wpm);

  return NextResponse.json({ session: raceSession });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

  const { eq, desc } = await import("drizzle-orm");

  const sessions = await db.query.raceSessions.findMany({
    where: eq(raceSessions.userId, session.user.id),
    orderBy: [desc(raceSessions.completedAt)],
    limit,
  });

  return NextResponse.json({ sessions });
}