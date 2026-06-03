import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import PracticeClient from "./PracticeClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Practice" };

// No redirect — guests can practice freely.
// PracticeClient handles the guest vs signed-in difference.
export default async function PracticePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen bg-surface">
      <PracticeClient isGuest={!session?.user} />
    </main>
  );
}
