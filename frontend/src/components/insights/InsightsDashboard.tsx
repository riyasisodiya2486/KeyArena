"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useTypingEngine } from "@/hooks/useTypingEngine";
import { TypingDisplay } from "@/components/practice/TypingDisplay";
import { TypingInput } from "@/components/practice/TypingInput";

interface InsightsData {
  hasData:         boolean;
  totalRaces:      number;
  totalKeystrokes: number;
  overallAccuracy: number;
  consistency:     number;
  avgWpm:          number;
  bestWpm:         number;
  recentAvg:       number;
  improving:       boolean;
  bigramErrors:    { bigram: string; count: number }[];
  charErrors:      { char: string; count: number }[];
  weakChars:       string[];
  wpmTrend:        { race: number; wpm: number }[];
}

export function InsightsDashboard() {
  const [data,         setData]         = useState<InsightsData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [drills,       setDrills]       = useState<string[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillIndex,   setDrillIndex]   = useState(0);
  const [drillDone,    setDrillDone]    = useState<boolean[]>([]);

  const currentDrill = drills[drillIndex] ?? "";
  const engine       = useTypingEngine(currentDrill);

  useEffect(() => {
    fetch("/api/insights")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Auto-advance to next drill on completion
  useEffect(() => {
    if (engine.status === "finished" && currentDrill) {
      setDrillDone(prev => {
        const next = [...prev];
        next[drillIndex] = true;
        return next;
      });
      setTimeout(() => {
        if (drillIndex < drills.length - 1) {
          setDrillIndex(i => i + 1);
          engine.resetRace();
        }
      }, 1500);
    }
  }, [engine.status]);

  async function generateDrills() {
    if (!data?.hasData) return;
    setDrillLoading(true);
    setDrills([]);
    setDrillIndex(0);
    setDrillDone([]);
    engine.resetRace();
    try {
      const res = await fetch("/api/insights/drills", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          weakChars:    data.weakChars,
          bigramErrors: data.bigramErrors,
          avgWpm:       data.avgWpm,
        }),
      });
      const json = await res.json();
      setDrills(json.drills ?? []);
    } catch {
      alert("Failed to generate drills. Try again.");
    } finally {
      setDrillLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-3">
        <div className="w-6 h-6 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
        <span className="text-ink-2">Analysing your typing history…</span>
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="card p-10 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h2 className="text-lg font-semibold text-ink mb-2">No data yet</h2>
        <p className="text-ink-2 text-sm">Complete at least one race to see your insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Summary strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avg WPM",      value: data.avgWpm,            mono: true, color: "text-brand-400" },
          { label: "Best WPM",     value: data.bestWpm,           mono: true, color: "text-ink" },
          { label: "Accuracy",     value: `${data.overallAccuracy}%`, mono: false, color: data.overallAccuracy >= 95 ? "text-green-400" : "text-ink" },
          { label: "Consistency",  value: `${data.consistency}%`, mono: false, color: "text-ink" },
        ].map(s => (
          <div key={s.label} className="card p-5 text-center">
            <div className={`text-3xl font-bold mb-1 ${s.color} ${s.mono ? "font-mono" : ""}`}>
              {s.value}
            </div>
            <div className="text-xs text-ink-3">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Trend + improving badge ───────────────────────────────────── */}
      {data.improving && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3
                        flex items-center gap-3">
          <span className="text-xl">📈</span>
          <div>
            <p className="text-sm font-medium text-green-400">You're improving!</p>
            <p className="text-xs text-ink-2">
              Recent avg <span className="font-mono font-bold">{data.recentAvg}</span> wpm vs
              overall avg <span className="font-mono font-bold">{data.avgWpm}</span> wpm
            </p>
          </div>
        </div>
      )}

      {/* ── WPM trend chart ───────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider mb-5">
          WPM over last {data.wpmTrend.length} races
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.wpmTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#E8593C" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#E8593C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262A" />
            <XAxis dataKey="race" tick={{ fill: "#6B6A67", fontSize: 11 }}
              axisLine={false} tickLine={false} label={{ value: "Race #", position: "insideBottom", fill: "#6B6A67", fontSize: 11 }} />
            <YAxis tick={{ fill: "#6B6A67", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto","auto"]} />
            <Tooltip
              contentStyle={{ background: "#1E1E21", border: "1px solid #303035", borderRadius: "8px", fontSize: "12px" }}
              formatter={(v: number) => [`${v} wpm`, "WPM"]}
            />
            <Area type="monotone" dataKey="wpm" stroke="#E8593C" strokeWidth={2}
              fill="url(#wg)" dot={{ fill: "#E8593C", r: 3, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bigram error cards ────────────────────────────────────────── */}
      {data.bigramErrors.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider mb-1">
            Most-missed character pairs
          </h2>
          <p className="text-xs text-ink-3 mb-4">
            These bigrams cause the most errors across all your races.
            AI drills below target these specifically.
          </p>
          <div className="flex gap-2 flex-wrap">
            {data.bigramErrors.map(e => (
              <div key={e.bigram}
                className="bg-surface-2 border border-surface-3 rounded-lg px-4 py-3 text-center min-w-[70px]">
                <div className="font-mono text-xl font-bold text-brand-400">{e.bigram}</div>
                <div className="text-xs text-ink-3 mt-1">{e.count}× missed</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Char error table ──────────────────────────────────────────── */}
      {data.charErrors.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider mb-4">
            Hardest characters for you
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.charErrors.slice(0, 8).map((e, i) => {
              const pct = Math.round((e.count / data.charErrors[0].count) * 100);
              return (
                <div key={e.char} className="bg-surface-2 border border-surface-3 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-2xl font-bold text-ink">
                      {e.char === " " ? "space" : e.char}
                    </span>
                    <span className="text-xs text-ink-3">#{i + 1}</span>
                  </div>
                  <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-400 rounded-full"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-ink-3 mt-1">{e.count} errors</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AI drill generator ────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-medium text-ink-2 uppercase tracking-wider">
              AI-generated practice drills
            </h2>
            <p className="text-xs text-ink-3 mt-1">
              Custom sentences targeting your {data.weakChars.length > 0
                ? `weakest keys (${data.weakChars.join(", ")})`
                : "error patterns"}
            </p>
          </div>
          <button
            onClick={generateDrills}
            disabled={drillLoading}
            className="btn-primary text-sm px-5 py-2 flex items-center gap-2 flex-shrink-0"
          >
            {drillLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : drills.length > 0 ? "Regenerate drills" : "✨ Generate drills"}
          </button>
        </div>

        {drills.length === 0 && !drillLoading && (
          <div className="bg-surface-2 rounded-xl p-8 text-center">
            <div className="text-3xl mb-3">✨</div>
            <p className="text-sm text-ink-2 mb-1">
              Click "Generate drills" to get 5 custom sentences
            </p>
            <p className="text-xs text-ink-3">
              Powered by Claude — targets your specific weak spots
            </p>
          </div>
        )}

        {drills.length > 0 && (
          <div className="space-y-3">
            {/* Drill progress */}
            <div className="flex items-center gap-2 mb-4">
              {drills.map((_, i) => (
                <div key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    drillDone[i]
                      ? "bg-green-400"
                      : i === drillIndex
                      ? "bg-brand-400"
                      : "bg-surface-3"
                  }`} />
              ))}
              <span className="text-xs text-ink-3 flex-shrink-0">
                {drillDone.filter(Boolean).length}/{drills.length}
              </span>
            </div>

            {/* Current drill */}
            <div className="bg-surface-2 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-ink-3 uppercase tracking-wider">
                  Drill {drillIndex + 1} of {drills.length}
                </span>
                {drillDone[drillIndex] && (
                  <span className="text-xs text-green-400 font-medium">✓ Complete!</span>
                )}
              </div>

              {currentDrill && (
                <div className="space-y-3">
                  <TypingDisplay
                    chars={currentDrill.split("")}
                    charStates={engine.charStates}
                    cursorIndex={engine.cursorIndex}
                  />
                  {!drillDone[drillIndex] && (
                    <TypingInput
                      value={engine.inputValue}
                      status={engine.status}
                      onChange={engine.handleInput}
                      onStart={engine.startRace}
                    />
                  )}
                  {engine.status === "racing" && (
                    <div className="flex gap-4 text-sm">
                      <span className="text-ink-3">WPM: <span className="font-mono font-bold text-ink">{engine.stats.wpm}</span></span>
                      <span className="text-ink-3">Accuracy: <span className="font-mono font-bold text-ink">{engine.stats.accuracy}%</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* All drills list */}
            <div className="space-y-2 mt-4">
              {drills.map((drill, i) => (
                <div key={i}
                  onClick={() => { setDrillIndex(i); if (!drillDone[i]) engine.resetRace(); }}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    i === drillIndex
                      ? "bg-brand-400/10 border border-brand-400/30"
                      : "bg-surface-2 border border-surface-3 hover:bg-surface-3"
                  }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center
                                   text-xs font-bold flex-shrink-0 ${
                    drillDone[i]
                      ? "bg-green-500 text-white"
                      : i === drillIndex
                      ? "bg-brand-400 text-white"
                      : "bg-surface-3 text-ink-3"
                  }`}>
                    {drillDone[i] ? "✓" : i + 1}
                  </div>
                  <p className="text-sm text-ink-2 truncate">{drill}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
