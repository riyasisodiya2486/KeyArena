"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession }            from "next-auth/react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { AppIcon } from "@/components/ui/AppIcon";
import { useTypingEngine }       from "@/hooks/useTypingEngine";
import { TypingDisplay }         from "@/components/practice/TypingDisplay";
import { TypingInput }           from "@/components/practice/TypingInput";
import { StatsHud }              from "@/components/practice/StatsHud";
import { DifficultySelector, type Difficulty } from "@/components/practice/DifficultySelector";
import { ResultsScreen }         from "@/components/practice/ResultsScreen";
import { ALL_PASSAGES, getRandomPassage } from "@/lib/passages";

interface Props {
  isGuest: boolean;
  initialDifficulty: Difficulty;
}

export default function PracticeClient({ isGuest, initialDifficulty }: Props) {
  const { data: session } = useSession();

  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  // Keep the first render deterministic so the server and browser hydrate the
  // same passage. Randomize only in response to a user action.
  const [passage, setPassage]       = useState<ReturnType<typeof getRandomPassage>>(() => {
    const initial = ALL_PASSAGES.find((item) => item.difficulty === initialDifficulty) ?? ALL_PASSAGES[0];
    return { ...initial, id: encodeURIComponent(initial.content).slice(0, 8) };
  });
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [saving,  setSaving]        = useState(false);
  const [savedId, setSavedId]       = useState<string | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  // Guest: how many races played this session (to show nudge after 2)
  const [guestRaces, setGuestRaces] = useState(0);

  const raceText = useMemo(
    () => passage.content.replace(/[\u200B-\u200D\uFEFF\r]/g, ""),
    [passage.content],
  );

  const passageStream = useMemo(() => {
    const sourcePassages = [raceText, ...ALL_PASSAGES
      .filter((item) => item.difficulty === difficulty)
      .map((item) => item.content.replace(/[\u200B-\u200D\uFEFF\r]/g, ""))
      .filter((content) => content !== raceText)];
    const stream = [...sourcePassages];
    let wordCount = sourcePassages.reduce((total, text) => total + text.trim().split(/\s+/).length, 0);
    let nextPassageIndex = 0;
    while (wordCount < 2500 && sourcePassages.length > 0) {
      const next = sourcePassages[nextPassageIndex % sourcePassages.length];
      stream.push(next);
      wordCount += next.trim().split(/\s+/).length;
      nextPassageIndex += 1;
    }
    return stream.join(" ");
  }, [difficulty, raceText]);

  const engine = useTypingEngine(passageStream, { durationSeconds, windowed: true });

  // â”€â”€ Change difficulty â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function changeDifficulty(d: Difficulty) {
    if (engine.status === "racing") return;
    setDifficulty(d);
    setPassage(getRandomPassage(d));
    engine.resetRace();
    setSavedId(null);
    setSaveAttempted(false);
  }

  function changeDuration(seconds: number) {
    if (engine.status === "racing") return;
    setDurationSeconds(seconds);
    engine.resetRace();
    setSavedId(null);
    setSaveAttempted(false);
  }

  // â”€â”€ Next passage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ Save race to DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveRace = useCallback(async () => {
    if (!session?.user) return; // guests don't save
    if (saveAttempted) return;
    setSaveAttempted(true);
    setSaving(true);
    try {
      const res = await fetch("/api/races", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:         "solo",
          difficulty,
          wpm:          Math.max(0, Math.round(engine.stats.wpm)),
          rawWpm:       Math.max(0, Math.round(engine.stats.rawWpm)),
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
  }, [session, difficulty, engine, saveAttempted]);

  const nextPassage = useCallback(async () => {
    if (engine.status === "finished" && session?.user && !savedId && !saveAttempted) {
      await saveRace();
    }
    setPassage(getRandomPassage(difficulty, passage.id));
    engine.resetRace();
    setSavedId(null);
    setSaveAttempted(false);
    if (isGuest) setGuestRaces((n) => n + 1);
  }, [engine, difficulty, passage.id, session, savedId, saveAttempted, isGuest, saveRace]);

  // â”€â”€ Retry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function retryPassage() {
    engine.resetRace();
    setSavedId(null);
    setSaveAttempted(false);
  }

  // Auto-save for signed-in users when race finishes
  useEffect(() => {
    if (engine.status === "finished" && session?.user && !savedId && !saveAttempted && !saving) {
      saveRace();
    }
  }, [engine.status, session, savedId, saveAttempted, saving, saveRace]);

  return (
    <main className="ka-practice-page">
      <Navbar />

      <div className="ka-practice-shell">

      {/* â”€â”€ Guest banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isGuest && (
        <div className="mb-6 bg-brand-400/5 border border-brand-400/20 rounded-xl
                        px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-ink">
              You&apos;re practising as a guest
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

      {/* â”€â”€ After 2 guest races â€” strong nudge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isGuest && guestRaces >= 2 && engine.status === "idle" && (
        <div className="mb-6 bg-surface-1 border border-surface-3 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-ink mb-1">
            <><AppIcon name="trophy" size={15} className="inline mr-2 text-brand-400" />You&apos;ve done {guestRaces} races — want to track your progress?</>
          </p>
          <p className="text-xs text-ink-2 mb-3">
            Create a free account to unlock your personal stats, WPM history chart, and global ranking.
          </p>
          <Link href="/auth/signup?callbackUrl=/practice"
            className="btn-primary text-xs px-4 py-2 inline-block">
            Sign up â€” it&apos;s free â†’
          </Link>
        </div>
      )}

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="ka-practice-heading">
        <div>
          <p className="ka-practice-eyebrow">01 / FIND YOUR RHYTHM</p>
          <h1>Typing <i>zone.</i></h1>
          <p className="ka-practice-subtitle">
            Continuous session Â· {durationSeconds} seconds
            {isGuest && <span className="ml-2 text-ink-3">(guest)</span>}
          </p>
        </div>
        <div className="ka-practice-controls">
          <div className="ka-difficulty-control">
            <span>DIFFICULTY</span>
            <DifficultySelector value={difficulty} onChange={changeDifficulty} disabled={engine.status === "racing"} />
          </div>
          <div className="ka-duration-control" role="group" aria-label="Session length">
            <span>SESSION</span>
            <div>{[15, 30, 60, 120].map((seconds) => <button key={seconds} type="button" disabled={engine.status === "racing"} aria-pressed={durationSeconds === seconds} className={durationSeconds === seconds ? "is-selected" : ""} onClick={() => changeDuration(seconds)}>{seconds}s</button>)}</div>
          </div>
        </div>
      </div>

      {engine.status === "finished" ? (
        /* â”€â”€ Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
                  {engine.stats.wpm} WPM Â· {engine.stats.accuracy}% accuracy â€” don&apos;t let it disappear!
                </p>
              </div>
              <Link href="/auth/signup?callbackUrl=/practice"
                className="btn-primary text-xs px-4 py-2 flex-shrink-0">
                Create free account â†’
              </Link>
            </div>
          )}
        </>
      ) : (
        /* â”€â”€ Race UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        <div className="space-y-4">
          <StatsHud stats={engine.stats} status={engine.status} remainingMs={engine.remainingMs} />

          <TypingDisplay
            chars={Array.from(engine.displayPassage)}
            charStates={engine.displayCharStates}
            cursorIndex={engine.displayCursorIndex}
            windowStartIndex={engine.displayStartIndex}
          />

          <TypingInput
            value={engine.inputValue}
            status={engine.status}
            onChange={engine.handleInput}
            onStart={engine.startRace}
            onCancel={engine.resetRace}
            captureGlobalHotkeys
            startOnClick={false}
            allowNewlines={difficulty === "code"}
          />

          {engine.status === "idle" && <p className="ka-practice-hint">Choose a session length, then press any key. The clock starts with your first keystroke.</p>}

          {engine.status === "racing" && (
            <button
              onClick={engine.resetRace}
              className="text-xs text-ink-3 hover:text-ink-2 transition-colors mx-auto block"
            >
              â†º restart
            </button>
          )}
        </div>
      )}
      </div>
    </main>
  );
}
