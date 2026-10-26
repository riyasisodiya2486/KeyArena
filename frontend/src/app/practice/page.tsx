import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import PracticeClient from "./PracticeClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Practice" };

// No redirect — guests can practice freely.
// PracticeClient handles the guest vs signed-in difference.
const difficulties = ["easy", "medium", "hard", "code"] as const;

export default async function PracticePage({
  searchParams,
}: {
  searchParams?: { difficulty?: string };
}) {
  const session = await getServerSession(authOptions);
  const initialDifficulty = difficulties.find((difficulty) => difficulty === searchParams?.difficulty) ?? "medium";

  return (
    <main className="min-h-screen bg-surface">
      <PracticeClient isGuest={!session?.user} initialDifficulty={initialDifficulty} />
    </main>
  );
}
