import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { redis } from "@/lib/redis";

function buildFallbackDrills(weakChars: string[] = [], bigrams: string[] = []): string[] {
  const chars = weakChars.filter(Boolean).slice(0, 5);
  const pairs = bigrams.filter(Boolean).slice(0, 5);

  const c1 = chars[0] ?? "e";
  const c2 = chars[1] ?? "t";
  const c3 = chars[2] ?? "a";
  const b1 = pairs[0] ?? "th";
  const b2 = pairs[1] ?? "er";

  return [
    `The ${b1}eater near the river has a better seat for every eager reader.`,
    `A careful ${c1}${c2}${c3}lete wrote three neat letters after the late training session.`,
    `These travelers prefer greener streets where ${b2}gonomic desks reduce wrist strain.`,
    `Every team member rehearsed the ${b1}eme before the theater debate began.`,
    `After the server restart, the trainer created a steady routine to raise accuracy.`,
  ];
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 drill generations per user per hour
  const rateLimitKey = `drills:ratelimit:${session.user.id}`;
  const current = await redis.incr(rateLimitKey);
  if (current === 1) await redis.expire(rateLimitKey, 3600); // 1 hour TTL
  if (current > 5) {
    return NextResponse.json(
      { error: "Rate limit: max 5 drill generations per hour" },
      { status: 429 }
    );
  }

  const { weakChars, bigramErrors, avgWpm } = await req.json();

  if (!weakChars?.length && !bigramErrors?.length) {
    return NextResponse.json({ error: "No weak spots provided" }, { status: 400 });
  }

  const top5CharsList = (weakChars ?? []).slice(0, 5);
  const top5BigramList = (bigramErrors ?? []).slice(0, 5).map((b: { bigram: string }) => b.bigram);

  const top5Chars   = top5CharsList.join(", ");
  const top5Bigrams = top5BigramList.join(", ");

  const prompt = `You are a typing coach. A user has these weak spots based on their keystroke analysis:
- Most-missed characters: ${top5Chars || "none identified"}
- Most-missed character pairs (bigrams): ${top5Bigrams || "none identified"}
- Their average WPM: ${avgWpm}

Generate exactly 5 short typing drill sentences (10-20 words each) that heavily feature these weak characters and bigrams. Each sentence should be a real English sentence, not random letters. Make them progressively harder.

Respond ONLY with a JSON array of 5 strings. No explanation, no markdown, no backticks. Example format:
["sentence one here", "sentence two here", "sentence three here", "sentence four here", "sentence five here"]`;

  const fallback = buildFallbackDrills(top5CharsList, top5BigramList);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ drills: fallback });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 1000,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ drills: fallback });
    }

    const data = await res.json();
    const raw  = data.content?.[0]?.text ?? "[]";

    let drills: string[] = [];
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      drills = JSON.parse(arrayMatch?.[0] ?? "[]");
      if (!Array.isArray(drills) || drills.length === 0) {
        drills = fallback;
      }
    } catch {
      drills = fallback;
    }

    return NextResponse.json({ drills: drills.slice(0, 5) });
  } catch {
    return NextResponse.json({ drills: fallback });
  }
}
