import { NextRequest, NextResponse } from "next/server";
import { setLeaderboardExpiry } from "@/lib/redis";

// Vercel cron calls this — set in vercel.json
// Locally you can hit: GET /api/cron/reset-boards?secret=your_cron_secret

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await setLeaderboardExpiry();
    return NextResponse.json({
      ok:        true,
      timestamp: new Date().toISOString(),
      message:   "Leaderboard TTLs refreshed",
    });
  } catch (err) {
    console.error("Cron reset-boards error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

