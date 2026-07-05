"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  live:     "bg-green-500/10 text-green-400 border-green-500/30",
  finished: "bg-surface-2 text-ink-3 border-surface-3",
};

export default function AdminCompetitionsPage() {
  const { data: session } = useSession();
  const [comps,   setComps]   = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name:            "",
    description:     "",
    scheduledAt:     "",
    maxParticipants: "500",
  });
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  async function fetchComps() {
    const res  = await fetch("/api/admin/competitions");
    const data = await res.json();
    if (res.ok) setComps(data.competitions ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchComps(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setCreating(true);
    try {
      const res  = await fetch("/api/admin/competitions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          maxParticipants: Number(form.maxParticipants),
          scheduledAt:     new Date(form.scheduledAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create"); return; }
      setSuccess(`Competition "${data.competition.name}" created!`);
      setForm({ name: "", description: "", scheduledAt: "", maxParticipants: "500" });
      fetchComps();
    } finally {
      setCreating(false);
    }
  }

  async function handleStatus(id: string, status: string) {
    await fetch(`/api/admin/competitions/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    fetchComps();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    fetchComps();
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-10">

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold font-mono text-ink">Admin</h1>
              <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/30
                               px-2 py-0.5 rounded font-medium">Restricted</span>
            </div>
            <p className="text-ink-2 text-sm">Competition management dashboard</p>
          </div>

          {/* Create form */}
          <div className="card p-6 mb-8">
            <h2 className="text-sm font-semibold text-ink uppercase tracking-wider mb-5">
              Create competition
            </h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-3 uppercase tracking-wider mb-1.5">
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="KeyRace Open #1"
                  required
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-3 uppercase tracking-wider mb-1.5">
                  Max participants
                </label>
                <input
                  type="number"
                  value={form.maxParticipants}
                  onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))}
                  min="2" max="10000"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-3 uppercase tracking-wider mb-1.5">
                  Scheduled at *
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  required
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-3 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="input w-full"
                />
              </div>

              <div className="md:col-span-2">
                {error   && <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">{error}</div>}
                {success && <div className="mb-3 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">{success}</div>}
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2"
                >
                  {creating ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                  ) : "Create competition →"}
                </button>
              </div>
            </form>
          </div>

          {/* Competitions list */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-3">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">
                All competitions ({comps.length})
              </h2>
            </div>

            {loading && (
              <div className="flex items-center justify-center h-32 gap-2">
                <div className="w-5 h-5 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
                <span className="text-ink-2 text-sm">Loading…</span>
              </div>
            )}

            {!loading && comps.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-ink-3">
                No competitions yet. Create one above.
              </div>
            )}

            <div className="divide-y divide-surface-3">
              {comps.map(comp => (
                <div key={comp.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-ink">{comp.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[comp.status] ?? STATUS_COLORS.upcoming}`}>
                          {comp.status}
                        </span>
                      </div>
                      {comp.description && <p className="text-sm text-ink-2 mb-1">{comp.description}</p>}
                      <p className="text-xs text-ink-3">
                        📅 {format(new Date(comp.scheduledAt), "MMM d, yyyy · h:mm a")} ·
                        👥 {comp.registrationCount}/{comp.maxParticipants} registered ·
                        🆔 <span className="font-mono">{comp.id.slice(0, 8)}</span>
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {comp.status === "upcoming" && (
                        <button
                          onClick={() => handleStatus(comp.id, "live")}
                          className="bg-green-500/10 text-green-400 border border-green-500/30
                                     text-xs px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors"
                        >
                          🔴 Go Live
                        </button>
                      )}
                      {comp.status === "live" && (
                        <button
                          onClick={() => handleStatus(comp.id, "finished")}
                          className="bg-surface-2 text-ink-3 border border-surface-3
                                     text-xs px-3 py-1.5 rounded-lg hover:bg-surface-3 transition-colors"
                        >
                          ⏹ End race
                        </button>
                      )}
                      <a
                        href={`/compete/${comp.id}`}
                        target="_blank"
                        className="bg-surface-2 text-ink-2 border border-surface-3
                                   text-xs px-3 py-1.5 rounded-lg hover:bg-surface-3 transition-colors"
                      >
                        👁 View
                      </a>
                      <button
                        onClick={() => handleDelete(comp.id, comp.name)}
                        className="bg-red-500/10 text-red-400 border border-red-500/30
                                   text-xs px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
