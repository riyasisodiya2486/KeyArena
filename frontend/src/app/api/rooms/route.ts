import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to create a room" }, { status: 401 });
  }
  // Proxy to backend
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
  const res = await fetch(`${backendUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId: session.user.id }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
