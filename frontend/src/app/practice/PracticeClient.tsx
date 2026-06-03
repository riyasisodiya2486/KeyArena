"use client";

import { useState, useCallback } from "react";
import { useSession }            from "next-auth/react";
import Link                      from "next/link";
import { useTypingEngine }       from "@/hooks/useTypingEngine";
import { TypingDisplay }         from "@/components/practice/TypingDisplay";
import { TypingInput }           from "@/components/practice/TypingInput";
import { StatsHud }              from "@/components/practice/StatsHud";
import { DifficultySelector, type Difficulty } from "@/components/practice/DifficultySelector";
import { ResultsScreen }         from "@/components/practice/ResultsScreen";
import { getRandomPassage }      from "@/lib/passages";

interface Props {
  isGuest: boolean;
}

export default function PracticeClient({ isGuest }: Props) {
  const { data: session } = useSession();

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [passage, setPassage]       = useState(() => getRandomPassage("medium"));
  const [saving,  setSaving]        = useState(false);
  const [savedId, setSavedId]       = useState<string | null>(null);
  // Guest: how many races played this session (to show nudge after 2)
  const [guestRaces, setGuestRaces] = useState(0);

  const engine = useTypingEngine(passage.content);

  // ── Change difficulty ────────────────────────────────────────────────────
  function changeDifficulty(d: Difficulty) {
    if (engine.status === "racing") return;
    setDifficulty(d);
    setPassage(getRandomPassage(d));
    engine.resetRace();
    setSavedId(null);
  }

  // ── Next passage ─────────────────────────────────────────────────────────
  const nextPassage = useCallback(async () => {
    if (engine.status === "finished" && session?.user && !savedId) {
      await saveRace();
    }
    setPassage(getRandomPassage(difficulty, passage.id));
    engine.resetRace();
    setSavedId(null);
    if (isGuest) setGuestRaces((n) => n + 1);
  }, [engine, difficulty, passage.id, session, savedId, isGuest]);

  // ── Retry ────────────────────────────────────────────────────────────────
  function retryPassage() {
    engine.resetRace();
    setSavedId(null);
  }

  // ── Save race to DB ───────────────────────────────────────────────────────
  async function saveRace() {
    if (!session?.user) return; // guests don't save
    setSaving(true);
    try {
      const res = await fetch("/api/races", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:         "solo",
          difficulty,
          wpm:          engine.stats.wpm,
          rawWpm:       engine.stats.rawWpm,
          accuracy:     engine.stats.accuracy,
          charsTyped:   engine.stats.charsTyped,
          errorsCount:  engine.stats.errorsCount,
          timeTakenMs:  engine.stats.elapsedMs,
          keystrokeLog: engine.keystrokeLog,
        }),
      });
      const data = await res.json();
      setSavedId(data.session?.id ?? null);
    } catch (err) {
      console.error("Failed to save race:", err);
    } finally {
      setSaving(false);
    }
  }

  // Auto-save for signed-in users when race finishes
  if (engine.status === "finished" && session?.user && !savedId && !saving) {
    saveRace();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">

      {/* ── Guest banner ───────────────────────────────────────────────── */}
      {isGuest && (
        <div className="mb-6 bg-brand-400/5 border border-brand-400/20 rounded-xl
                        px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-ink">
              You're practising as a guest
            </p>
            <p className="text-xs text-ink-2 mt-0.5">
              Sign up free to save your scores, track progress, and appear on the leaderboard.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/auth/signup?callbackUrl=/practice"
              className="btn-primary text-xs px-4 py-2">
              Create account
            </Link>
            <Link href="/auth/signin?callbackUrl=/practice"
              className="btn-ghost text-xs px-4 py-2">
              Sign in
            </Link>
          </div>
        </div>
      )}

      {/* ── After 2 guest races — strong nudge ─────────────────────────── */}
      {isGuest && guestRaces >= 2 && engine.status === "idle" && (
        <div className="mb-6 bg-surface-1 border border-surface-3 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-ink mb-1">
            🏆 You've done {guestRaces} races — want to track your progress?
          </p>
          <p className="text-xs text-ink-2 mb-3">
            Create a free account to unlock your personal stats, WPM history chart, and global ranking.
          </p>
          <Link href="/auth/signup?callbackUrl=/practice"
            className="btn-primary text-xs px-4 py-2 inline-block">
            Sign up — it's free →
          </Link>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono text-ink">Practice</h1>
          <p className="text-sm text-ink-2 mt-1">
            Solo typing · {passage.wordCount} words
            {isGuest && <span className="ml-2 text-ink-3">(guest)</span>}
          </p>
        </div>
        <DifficultySelector
          value={difficulty}
          onChange={changeDifficulty}
          disabled={engine.status === "racing"}
        />
      </div>

      {engine.status === "finished" ? (
        /* ── Results ─────────────────────────────────────────────────── */
        <>
          <ResultsScreen
            stats={engine.stats}
            keystrokeLog={engine.keystrokeLog}
            difficulty={difficulty}
            onRetry={retryPassage}
            onNext={nextPassage}
            saving={saving}
          />

          {/* Guest results nudge */}
          {isGuest && (
            <div className="mt-4 card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-ink">
                  Save this result to your profile
                </p>
                <p className="text-xs text-ink-2 mt-0.5">
                  {engine.stats.wpm} WPM · {engine.stats.accuracy}% accuracy — don't let it disappear!
                </p>
              </div>
              <Link href="/auth/signup?callbackUrl=/practice"
                className="btn-primary text-xs px-4 py-2 flex-shrink-0">
                Create free account →
              </Link>
            </div>
          )}
        </>
      ) : (
        /* ── Race UI ─────────────────────────────────────────────────── */
        <div className="space-y-4">
          <StatsHud stats={engine.stats} status={engine.status} />

          <TypingDisplay
            chars={passage.content.split("")}
            charStates={engine.charStates}
            cursorIndex={engine.cursorIndex}
          />

          <TypingInput
            value={engine.inputValue}
            status={engine.status}
            onChange={engine.handleInput}
            onStart={engine.startRace}
          />

          {engine.status === "racing" && (
            <button
              onClick={engine.resetRace}
              className="text-xs text-ink-3 hover:text-ink-2 transition-colors mx-auto block"
            >
              ↺ restart
            </button>
          )}
        </div>
      )}
    </div>
  );
}
