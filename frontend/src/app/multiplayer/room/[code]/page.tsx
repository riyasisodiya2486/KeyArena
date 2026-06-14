import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/config";
import { Navbar } from "@/components/layout/Navbar";
import { RoomClient } from "./RoomClient";

interface Props { params: { code: string } }

export default async function RoomPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/auth/signin?callbackUrl=/multiplayer/room/${params.code}`);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface">
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
          </div>
        }>
          <RoomClient
            code={params.code.toUpperCase()}
            userId={session.user.id}
            username={session.user.username}
            name={session.user.name ?? session.user.username}
            image={session.user.image ?? null}
          />
        </Suspense>
      </main>
    </>
  );
}
