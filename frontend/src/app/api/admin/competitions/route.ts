import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { competitions, competitionRegistrations, passages, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

// ── Admin check ───────────────────────────────────────────────────────────────
async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  // Simple admin check — in production use a role column on users table
  const admins = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim());
  if (!admins.includes(session.user.id)) return null;
  return session;
}

// GET /api/admin/competitions
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const list = await db.query.competitions.findMany({
    orderBy: [desc(competitions.scheduledAt)],
    limit: 50,
  });

  const withParticipants = await Promise.all(list.map(async (competition) => {
    const registeredUsers = await db
      .select({
        userId: users.id,
        username: users.username,
        name: users.name,
        registeredAt: competitionRegistrations.registeredAt,
      })
      .from(competitionRegistrations)
      .innerJoin(users, eq(users.id, competitionRegistrations.userId))
      .where(eq(competitionRegistrations.competitionId, competition.id));

    const status = competition.status === "racing"
      ? "live"
      : competition.status === "finished"
      ? "finished"
      : "upcoming";

    return {
      id: competition.id,
      name: competition.title,
      description: competition.description,
      reward: competition.reward,
      scheduledAt: competition.scheduledAt,
      maxParticipants: competition.maxPlayers,
      status,
      registrationCount: registeredUsers.length,
      participants: registeredUsers,
    };
  }));

  return NextResponse.json({ competitions: withParticipants });
}

// POST /api/admin/competitions — create new competition
const CreateSchema = z.object({
  name:            z.string().min(3).max(100),
  description:     z.string().max(500).optional(),
  scheduledAt:     z.string().datetime(),
  maxParticipants: z.number().int().min(2).max(10000).default(500),
  reward:          z.string().max(500).optional(),
  passageId:       z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const { name, description, scheduledAt, maxParticipants, passageId, reward } = parsed.data;

    // If no passageId is given, pick a random hard passage.
    let finalPassageId = passageId;
    if (!finalPassageId) {
      const p = await db.query.passages.findFirst({
        where: eq(passages.difficulty, "hard"),
        columns: { id: true },
      });
      finalPassageId = p?.id;
    }

    const [competition] = await db.insert(competitions).values({
      title: name,
      description: description ?? null,
      reward: reward?.trim() || null,
      startTime: new Date(scheduledAt),
      endTime: new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000),
      scheduledAt: new Date(scheduledAt),
      maxPlayers: maxParticipants,
      passageId: finalPassageId ?? null,
      status: "waiting",
    }).returning();

    if (!competition) {
      return NextResponse.json({ error: "Competition was not created." }, { status: 500 });
    }

    return NextResponse.json({ competition }, { status: 201 });
  } catch (error) {
    console.error("Failed to create competition:", error);
    return NextResponse.json(
      { error: "The server could not save this competition. Check the frontend server log for details." },
      { status: 500 },
    );
  }
}
