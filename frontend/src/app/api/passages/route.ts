import { NextRequest, NextResponse } from "next/server";
import { getRandomPassage, PASSAGES_BY_DIFFICULTY } from "@/lib/passages";
import type { Difficulty } from "@/components/practice/DifficultySelector";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const difficulty = (searchParams.get("difficulty") ?? "medium") as Difficulty;
  const excludeId  = searchParams.get("excludeId") ?? undefined;

  const validDifficulties: Difficulty[] = ["easy", "medium", "hard", "code"];
  if (!validDifficulties.includes(difficulty)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
  }

  const passage = getRandomPassage(difficulty, excludeId);
  return NextResponse.json({ passage });
}

// GET /api/passages/all?difficulty=easy
export async function POST(req: NextRequest) {
  const body = await req.json();
  const difficulty = (body.difficulty ?? "medium") as Difficulty;
  const passages = PASSAGES_BY_DIFFICULTY[difficulty] ?? [];
  return NextResponse.json({ passages, count: passages.length });
}