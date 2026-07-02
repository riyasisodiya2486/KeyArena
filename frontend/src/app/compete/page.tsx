"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { format } from "date-fns";

interface Competition {
  id:                string;
  name:              string;
  description:       string | null;
  scheduledAt:       string;
  maxParticipants:   number;
  registrationCount: number;
  status:            string;
}

export default function CompetePage() {
  const { data: session } = useSession();
  const [comps,    setComps]    = useState<Competition[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [joining,  setJoining]  = useState<string | null>(null);
  const [joined,   setJoined]   = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/compete")
      .then(r => r.json())
      .then(d => setComps(d.competitions ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleRegister(id: string) {
    if (!session?.user) return;
    setJoining(id);
    try {
      const res = await fetch("/api/compete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ competitionId: id }),
      });
      if (res.ok) {
        setJoined(prev => new Set([...prev, id]));
        setComps(prev => prev.map(comp =>
          comp.id === id
            ? { ...comp, registrationCount: Math.min(comp.maxParticipants, comp.registrationCount + 1) }
            : comp
        ));
      }
    } finally {
      setJoining(null);
    }
  }

  const statusColor: Record<string, string> = {
    upcoming:  "bg-blue-500/10 text-blue-400 border-blue-500/30",
    live:      "bg-green-500/10 text-green-400 border-green-500/30",
    finished:  "bg-surface-2 text-ink-3 border-surface-3",
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold font-mono text-ink mb-2">Competitions</h1>
            <p className="text-ink-2 text-sm">Large-scale events — up to 500 racers simultaneously</p>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-40 gap-3">
              <div className="w-6 h-6 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
              <span className="text-ink-2">Loading competitions…</span>
            </div>
          )}

          {!loading && comps.length === 0 && (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">🏆</div>
              <h2 className="text-lg font-semibold text-ink mb-2">No competitions yet</h2>
              <p className="text-sm text-ink-2">
                Competitions are created by admins. Check back soon!
              </p>
            </div>
          )}

          <div className="space-y-4">
            {comps.map(comp => {
              const isFull    = comp.registrationCount >= comp.maxParticipants;
              const isJoined  = joined.has(comp.id);
              const isLive    = comp.status === "live";
              const pctBase   = Math.round((comp.registrationCount / comp.maxParticipants) * 100);
              const pct       = comp.registrationCount > 0 ? Math.max(1, pctBase) : 0;

              return (
                <div key={comp.id} className="card p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="font-semibold text-ink">{comp.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor[comp.status] ?? statusColor.upcoming}`}>
                          {isLive ? "🔴 LIVE" : comp.status}
                        </span>
                      </div>
                      {comp.description && (
                        <p className="text-sm text-ink-2">{comp.description}</p>
                      )}
                      <p className="text-xs text-ink-3 mt-1">
                        📅 {format(new Date(comp.scheduledAt), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {isLive && isJoined ? (
                        <Link href={`/compete/${comp.id}`} className="btn-primary text-sm px-5 py-2.5">
                          Enter race →
                        </Link>
                      ) : isJoined ? (
                        <span className="text-sm text-green-400 font-medium">✓ Registered</span>
                      ) : isFull ? (
                        <span className="text-sm text-ink-3">Full</span>
                      ) : !session?.user ? (
                        <Link href="/auth/signin" className="btn-ghost text-sm px-4 py-2">
                          Sign in to join
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleRegister(comp.id)}
                          disabled={joining === comp.id}
                          className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
                        >
                          {joining === comp.id ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : "Register →"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div>
                    <div className="flex justify-between text-xs text-ink-3 mb-1.5">
                      <span>{comp.registrationCount.toLocaleString()} registered</span>
                      <span>{comp.maxParticipants.toLocaleString()} max</span>
                    </div>
                    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-yellow-400" : "bg-brand-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-ink-3 mt-1">{pct}% full</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
