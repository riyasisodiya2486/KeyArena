"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Navbar } from "@/components/layout/Navbar";
import { useTypingEngine } from "@/hooks/useTypingEngine";
import { TypingDisplay } from "@/components/practice/TypingDisplay";
import { TypingInput } from "@/components/practice/TypingInput";

interface TopEntry { rank: number; userId: string; wpm: number; }

export default function CompeteRacePage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const socketRef         = useRef<Socket | null>(null);
  const sentFinish        = useRef(false);
  const lastProgress      = useRef(0);

  const [phase,        setPhase]        = useState<"connecting"|"waiting"|"countdown"|"racing"|"finished">("connecting");
  const [countdown,    setCountdown]    = useState(3);
  const [top25,        setTop25]        = useState<TopEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [myRank,       setMyRank]       = useState<number | null>(null);
  const [passageText,  setPassageText]  = useState("");
  const [error,        setError]        = useState("");

  const engine = useTypingEngine(passageText);

  useEffect(() => {
    if (!session?.user) return;

    const s = io(
      `${process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000"}/compete`,
      { transports: ["websocket", "polling"] }
    );
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("join_competition", {
        competitionId: params.id,
        userId:        session.user.id,
        username:      session.user.username,
        name:          session.user.name ?? session.user.username,
        image:         session.user.image ?? null,
      }, (res: { ok: boolean; room?: { passageText: string; status: string }; playerCount?: number; error?: string }) => {
        if (!res.ok) { setError(res.error ?? "Failed to join"); return; }
        setPassageText(res.room?.passageText ?? "");
        setTotalPlayers(res.playerCount ?? 0);
        setPhase(res.room?.status === "racing" ? "racing" : "waiting");
      });
    });

    s.on("connect_error", () => setError("Could not connect to competition server"));
    s.on("participant_joined", (d: { playerCount: number }) => setTotalPlayers(d.playerCount));
    s.on("participant_left",   (d: { playerCount: number }) => setTotalPlayers(d.playerCount));

    s.on("countdown_start", (d: { countdownEnd: number; passage: string }) => {
      setPassageText(d.passage);
      setPhase("countdown");
      let rem = Math.ceil((d.countdownEnd - Date.now()) / 1000);
      setCountdown(rem);
      const t = setInterval(() => {
        rem -= 1;
        setCountdown(Math.max(0, rem));
        if (rem <= 0) clearInterval(t);
      }, 1000);
    });

    s.on("race_start", () => { setPhase("racing"); engine.startRace(); });

    s.on("comp_leaderboard_update", (d: { top25: TopEntry[]; totalPlayers: number }) => {
      setTop25(d.top25);
      setTotalPlayers(d.totalPlayers);
    });

    s.on("comp_player_finished", (d: { userId: string; rank: number }) => {
      if (d.userId === session.user.id) setMyRank(d.rank);
    });

    return () => { s.disconnect(); };
  }, [session]);

  // Throttled progress — 500ms for large events
  useEffect(() => {
    if (phase !== "racing" || engine.status !== "racing") return;
    const now = Date.now();
    if (now - lastProgress.current < 500) return;
    lastProgress.current = now;
    socketRef.current?.emit("comp_progress", {
      competitionId: params.id,
      userId:        session?.user?.id,
      progress:      engine.stats.progress,
      wpm:           engine.stats.wpm,
      accuracy:      engine.stats.accuracy,
    });
  }, [engine.stats.progress]);

  // Send finish
  useEffect(() => {
    if (engine.status !== "finished" || sentFinish.current || !session?.user) return;
    sentFinish.current = true;
    socketRef.current?.emit("comp_finished", {
      competitionId: params.id,
      userId:        session.user.id,
      wpm:           engine.stats.wpm,
      rawWpm:        engine.stats.rawWpm,
      accuracy:      engine.stats.accuracy,
      timeTakenMs:   engine.stats.elapsedMs,
      keystrokeLog:  engine.keystrokeLog,
    }, (res: { ok: boolean; rank?: number }) => {
      if (res.ok && res.rank) { setMyRank(res.rank); setPhase("finished"); }
    });
  }, [engine.status]);

  if (!session?.user) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-ink-2">Please <a href="/auth/signin" className="text-brand-400 underline">sign in</a> to compete.</p>
    </div>
  );

  if (error) return (
    <>
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-ink mb-2">Can't join competition</h2>
        <p className="text-sm text-ink-2 mb-6">{error}</p>
        <a href="/compete" className="btn-primary px-6 py-2.5 inline-block">Back to competitions</a>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold font-mono text-ink">Competition</h1>
              <p className="text-xs text-ink-3 mt-0.5">{totalPlayers.toLocaleString()} participants</p>
            </div>
            {myRank && (
              <div className="text-right">
                <p className="font-mono text-2xl font-bold text-brand-400">#{myRank.toLocaleString()}</p>
                <p className="text-xs text-ink-3">your rank</p>
              </div>
            )}
          </div>

          {phase === "connecting" && (
            <div className="flex items-center justify-center h-48 gap-3">
              <div className="w-6 h-6 border-2 border-surface-3 border-t-brand-400 rounded-full animate-spin" />
              <span className="text-ink-2">Joining competition…</span>
            </div>
          )}

          {phase === "waiting" && (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-4">⏳</div>
              <h2 className="text-xl font-semibold text-ink mb-2">Waiting for competition to start</h2>
              <p className="text-ink-2 text-sm">{totalPlayers.toLocaleString()} participants joined</p>
              <div className="flex items-center justify-center gap-2 mt-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {phase === "countdown" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/90 backdrop-blur-sm">
              <div className="text-center">
                {countdown > 0 ? (
                  <>
                    <div className="font-mono font-bold text-brand-400 leading-none mb-4"
                      style={{ fontSize: "clamp(80px,20vw,140px)" }}>{countdown}</div>
                    <p className="text-ink-2 text-xl">Get ready…</p>
                  </>
                ) : (
                  <>
                    <div className="font-mono font-bold text-green-400 leading-none mb-4"
                      style={{ fontSize: "clamp(60px,15vw,100px)" }}>GO!</div>
                    <p className="text-ink-2 text-xl">Type as fast as you can!</p>
                  </>
                )}
              </div>
            </div>
          )}

          {(phase === "racing" || phase === "finished") && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "WPM",      value: engine.stats.wpm || "—",            color: engine.stats.wpm >= 80 ? "text-brand-400" : "text-ink" },
                    { label: "Accuracy", value: engine.stats.wpm ? `${engine.stats.accuracy}%` : "—", color: "text-ink" },
                    { label: "Progress", value: engine.stats.wpm ? `${engine.stats.progress}%` : "—", color: "text-ink" },
                  ].map(s => (
                    <div key={s.label} className="card p-3 text-center">
                      <div className={`font-mono text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-ink-3">{s.label}</div>
                    </div>
                  ))}
                </div>

                {passageText && phase === "racing" && engine.status !== "finished" && (
                  <>
                    <TypingDisplay chars={passageText.split("")} charStates={engine.charStates} cursorIndex={engine.cursorIndex} />
                    <TypingInput value={engine.inputValue} status={engine.status} onChange={engine.handleInput} onStart={engine.startRace} />
                  </>
                )}

                {(engine.status === "finished" || phase === "finished") && (
                  <div className="card p-6 text-center">
                    <div className="text-3xl mb-2">{myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🏁"}</div>
                    <h2 className="text-xl font-bold text-ink mb-1">
                      {myRank ? `You finished #${myRank.toLocaleString()}!` : "Race complete!"}
                    </h2>
                    <p className="text-ink-2 text-sm">{engine.stats.wpm} WPM · {engine.stats.accuracy}% accuracy</p>
                    <div className="flex gap-3 justify-center mt-4">
                      <a href="/insights" className="btn-primary px-5 py-2.5 text-sm">View AI Insights →</a>
                      <a href="/leaderboard" className="btn-ghost px-5 py-2.5 text-sm">Leaderboard</a>
                    </div>
                  </div>
                )}
              </div>

              <div className="card overflow-hidden h-fit">
                <div className="px-4 py-3 border-b border-surface-3">
                  <p className="text-xs font-medium text-ink-2 uppercase tracking-wider">Live top 25</p>
                  <p className="text-xs text-ink-3">{totalPlayers.toLocaleString()} total racers</p>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "420px" }}>
                  {top25.map(entry => (
                    <div key={entry.userId}
                      className={`flex items-center gap-2 px-4 py-2.5 border-b border-surface-3 last:border-0 ${
                        entry.userId === session?.user?.id ? "bg-brand-400/5" : ""}`}>
                      <span className="font-mono text-xs text-ink-3 w-6 text-right">{entry.rank}</span>
                      <span className={`flex-1 truncate text-xs ${entry.userId === session?.user?.id ? "text-brand-400 font-medium" : "text-ink-2"}`}>
                        {entry.userId === session?.user?.id ? "you" : `racer_${entry.rank}`}
                      </span>
                      <span className="font-mono text-xs font-bold text-ink">{entry.wpm}</span>
                    </div>
                  ))}
                  {top25.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-ink-3">Waiting for racers…</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
