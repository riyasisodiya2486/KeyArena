import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { competitionRegistrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export async function GET() {
  const res  = await fetch(`${BACKEND}/api/compete`);
  const data = await res.json();
  const session = await getServerSession(authOptions);
  if (res.ok && session?.user && Array.isArray(data.competitions)) {
    const registrations = await db.select({ competitionId: competitionRegistrations.competitionId })
      .from(competitionRegistrations)
      .where(eq(competitionRegistrations.userId, session.user.id));
    const registeredIds = new Set(registrations.map((registration) => registration.competitionId));
    data.competitions = data.competitions.map((competition: { id: string }) => ({
      ...competition,
      isRegistered: registeredIds.has(competition.id),
    }));
  }
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const res  = await fetch(`${BACKEND}/api/compete/${body.competitionId}/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId: session.user.id }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
