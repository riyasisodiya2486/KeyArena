import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
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

  const { status } = await req.json();
  if (!["upcoming", "live", "finished"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const [comp] = await db
    .update(competitions)
    .set({ status, ...(status === "live" ? { startedAt: new Date() } : {}) })
    .where(eq(competitions.id, params.id))
    .returning();

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If going LIVE — emit countdown_start to all connected clients via Redis pub/sub
  if (status === "live") {
    const countdownEnd = Date.now() + 5000; // 5 second countdown

    // Get passage text for the room
    const compRoom = await redis.get(`comp:${params.id}`);
    const passageText = compRoom
      ? JSON.parse(compRoom).passageText
      : "The quick brown fox jumps over the lazy dog.";

    // Publish to backend (backend subscribes and emits to Socket.io)
    await redis.publish("competition:start", JSON.stringify({
      competitionId: params.id,
      countdownEnd,
      passage: passageText,
    }));
  }

  return NextResponse.json({ competition: comp });
}

// DELETE /api/admin/competitions/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(competitions).where(eq(competitions.id, params.id));
  return NextResponse.json({ ok: true });
}
