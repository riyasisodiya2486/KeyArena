import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/config";
import { Navbar } from "@/components/layout/Navbar";
import { InsightsDashboard } from "@/components/insights/InsightsDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI Insights" };

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin?callbackUrl=/insights");

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold font-mono text-ink">AI Insights</h1>
              <span className="text-xs bg-brand-400/10 text-brand-400 border border-brand-400/30
                               px-2 py-1 rounded-full font-medium">Powered by Claude</span>
            </div>
            <p className="text-ink-2 text-sm">
              Weakness detection from your keystroke logs + AI-generated drills targeting your exact problem characters.
            </p>
          </div>
          <InsightsDashboard />
        </div>
      </main>
    </>
  );
}
