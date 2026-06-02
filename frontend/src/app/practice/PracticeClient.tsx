"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTypingEngine } from "@/hooks/useTypingEngine";
import { TypingDisplay } from "@/components/practice/TypingDisplay";
import { TypingInput } from "@/components/practice/TypingInput";
import { StatsHud } from "@/components/practice/StatsHud";
import { DifficultySelector, type Difficulty } from "@/components/practice/DifficultySelector";
import { ResultsScreen } from "@/components/practice/ResultsScreen";
import { getRandomPassage } from "@/lib/passages";

export default function PracticePage() {
  const { data: session } = useSession();

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [passage, setPassage]       = useState(() => getRandomPassage("medium"));
  const [saving, setSaving]         = useState(false);
  const [savedId, setSavedId]       = useState<string | null>(null);

  const engine = useTypingEngine(passage.content);

  // ── Change difficulty ────────────────────────────────────────────────────
  function changeDifficulty(d: Difficulty) {
    if (engine.status === "racing") return; // don't interrupt a race
    setDifficulty(d);
    setPassage(getRandomPassage(d));
    engine.resetRace();
    setSavedId(null);
  }

  // ── Next passage ─────────────────────────────────────────────────────────
  const nextPassage = useCallback(async () => {
    // Save current race to DB first
    if (engine.status === "finished" && session?.user && !savedId) {
      await saveRace();
    }
    setPassage(getRandomPassage(difficulty, passage.id));
    engine.resetRace();
    setSavedId(null);
  }, [engine, difficulty, passage.id, session, savedId]);

  // ── Retry same passage ───────────────────────────────────────────────────
  function retryPassage() {
    engine.resetRace();
    setSavedId(null);
  }

  // ── Save race to backend ─────────────────────────────────────────────────
  async function saveRace() {
    if (!session?.user) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/races`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId:       session.user.id,
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
        }
      );
      const data = await res.json();
      setSavedId(data.session?.id ?? null);
    } catch (err) {
      console.error("Failed to save race:", err);
    } finally {
      setSaving(false);
    }
  }

  // Auto-save when race finishes
  if (engine.status === "finished" && session?.user && !savedId && !saving) {
    saveRace();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono text-ink">Practice</h1>
          <p className="text-sm text-ink-2 mt-1">Solo typing · {passage.wordCount} words</p>
        </div>
        <DifficultySelector
          value={difficulty}
          onChange={changeDifficulty}
          disabled={engine.status === "racing"}
        />
      </div>

      {engine.status === "finished" ? (
        /* ── Results ─────────────────────────────────────────────── */
        <ResultsScreen
          stats={engine.stats}
          keystrokeLog={engine.keystrokeLog}
          difficulty={difficulty}
          onRetry={retryPassage}
          onNext={nextPassage}
          saving={saving}
        />
      ) : (
        /* ── Race UI ─────────────────────────────────────────────── */
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