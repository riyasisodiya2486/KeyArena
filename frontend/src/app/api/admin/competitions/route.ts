import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { competitions, competitionRegistrations, passages } from "@/lib/db/schema";
import { desc, count, eq } from "drizzle-orm";
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

  const withCounts = await Promise.all(list.map(async (c) => {
    const [{ value: regCount }] = await db
      .select({ value: count() })
      .from(competitionRegistrations)
      .where(eq(competitionRegistrations.competitionId, c.id));
    return { ...c, registrationCount: Number(regCount) };
  }));

  return NextResponse.json({ competitions: withCounts });
}

// POST /api/admin/competitions — create new competition
const CreateSchema = z.object({
  name:            z.string().min(3).max(100),
  description:     z.string().max(500).optional(),
  scheduledAt:     z.string().datetime(),
  maxParticipants: z.number().int().min(2).max(10000).default(500),
  passageId:       z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body   = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { name, description, scheduledAt, maxParticipants, passageId } = parsed.data;

  // If no passageId given, pick a random hard passage
  let finalPassageId = passageId;
  if (!finalPassageId) {
    const p = await db.query.passages.findFirst({
      where: eq(passages.difficulty, "hard"),
      columns: { id: true },
    });
    finalPassageId = p?.id;
  }

  const [comp] = await db.insert(competitions).values({
    name,
    description:     description ?? null,
    scheduledAt:     new Date(scheduledAt),
    maxParticipants,
    passageId:       finalPassageId ?? null,
    status:          "upcoming",
  }).returning();

  return NextResponse.json({ competition: comp }, { status: 201 });
}
