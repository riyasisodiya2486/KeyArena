import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const isAdmin = Boolean(session?.user?.id && adminIds.includes(session.user.id));

  return NextResponse.json({ isAdmin }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
