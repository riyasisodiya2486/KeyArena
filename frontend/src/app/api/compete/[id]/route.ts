import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const response = await fetch(`${BACKEND}/api/compete/${encodeURIComponent(params.id)}`, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Competition status is temporarily unavailable." }, { status: 503 });
  }
}
