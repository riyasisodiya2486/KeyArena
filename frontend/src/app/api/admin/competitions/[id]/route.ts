import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { competitions, competitionRegistrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const admins = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim());
  if (!admins.includes(session.user.id)) return null;
  return session;
}

// PATCH /api/admin/competitions/:id — update status (upcoming → live → finished)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (typeof body.reward === "string") {
    const reward = body.reward.trim();
    if (reward.length > 500) {
      return NextResponse.json({ error: "Reward must be 500 characters or fewer." }, { status: 400 });
    }
    const [competition] = await db.update(competitions)
      .set({ reward: reward || null })
      .where(eq(competitions.id, params.id))
      .returning();
    if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    return NextResponse.json({ competition });
  }

  const { status } = body;
  if (!["upcoming", "live", "finished"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const databaseStatus = status === "live" ? "racing" : status === "upcoming" ? "waiting" : "finished";
  const now = new Date();
  const [competition] = await db.update(competitions)
    .set({
      status: databaseStatus,
      ...(status === "live" ? { startedAt: now } : {}),
      ...(status === "finished" ? { finishedAt: now } : {}),
    })
    .where(eq(competitions.id, params.id))
    .returning();

  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  if (status === "live") {
    await redis.publish("competition:start", JSON.stringify({
      competitionId: params.id,
      countdownEnd: Date.now() + 5000,
    }));
  } else if (status === "finished") {
    await redis.publish("competition:finish", JSON.stringify({ competitionId: params.id }));
  }

  return NextResponse.json({ competition });
}

// DELETE /api/admin/competitions/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const deleted = await db.transaction(async (tx) => {
    // Registrations reference the competition, so remove them in the same
    // transaction before deleting the parent row.
    await tx.delete(competitionRegistrations)
      .where(eq(competitionRegistrations.competitionId, params.id));
    return tx.delete(competitions)
      .where(eq(competitions.id, params.id))
      .returning({ id: competitions.id });
  });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  await redis.del([`comp:${params.id}`, `comp_lb:${params.id}`, `comp_finished:${params.id}`, `comp_final:${params.id}`]);

  return NextResponse.json({ ok: true });
}
