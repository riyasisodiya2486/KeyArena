import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/config";
import { Navbar } from "@/components/layout/Navbar";
import PracticeClient from "./PracticeClient";

export const metadata = { title: "Practice" };

export default async function PracticePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin?callbackUrl=/practice");

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface">
        <PracticeClient />
      </main>
    </>
  );
}