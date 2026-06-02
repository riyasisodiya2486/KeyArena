import type { KeystrokeEvent } from "@/lib/db/schema";

// ─── Core WPM formulas ─────────────────────────────────────────────────────
// Industry standard: 1 word = 5 characters

/**
 * Net WPM — only counts correctly-typed characters.
 * This is the number shown on leaderboards.
 */
export function calcNetWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs < 100) return 0;
  const minutes = elapsedMs / 60000;
  return Math.max(0, Math.round((correctChars / 5) / minutes));
}

/**
 * Raw WPM — every character typed, errors included.
 * Shows natural typing speed without penalty.
 */
export function calcRawWpm(totalChars: number, elapsedMs: number): number {
  if (elapsedMs < 100) return 0;
  const minutes = elapsedMs / 60000;
  return Math.max(0, Math.round((totalChars / 5) / minutes));
}

/**
 * Accuracy — based on total keystrokes ever made (not current state).
 * Backspacing an error doesn't erase it from the error count.
 */
export function calcAccuracy(totalChars: number, errorsCount: number): number {
  if (totalChars === 0) return 100;
  const correct = Math.max(0, totalChars - errorsCount);
  return Math.round((correct / totalChars) * 100);
}

/**
 * Consistency score — lower std deviation in keystroke intervals = higher score.
 * Used for AI insights on Day 6.
 */
export function calcConsistency(log: KeystrokeEvent[]): number {
  if (log.length < 3) return 100;
  const intervals = log.slice(1).map((k, i) => k.timestamp - log[i].timestamp);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance =
    intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  // Normalise: stdDev < 50ms = 100%, stdDev > 400ms = 0%
  return Math.max(0, Math.min(100, Math.round(100 - (stdDev / 4))));
}

/**
 * Format elapsed milliseconds as mm:ss
 */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// ─── Keystroke analysis (for AI insights later) ────────────────────────────

export type BigramError = {
  bigram: string;
  count: number;
};

/**
 * Find the most commonly mistyped character pairs.
 * Returns top N bigrams by error frequency.
 */
export function getTopBigramErrors(log: KeystrokeEvent[], n = 5): BigramError[] {
  const errors = log.filter((k) => !k.correct);
  const bigramCounts: Record<string, number> = {};

  for (let i = 1; i < log.length; i++) {
    if (!log[i].correct) {
      const bigram = `${log[i - 1].expected}${log[i].expected}`;
      bigramCounts[bigram] = (bigramCounts[bigram] ?? 0) + 1;
    }
  }

  return Object.entries(bigramCounts)
    .map(([bigram, count]) => ({ bigram, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Identify which characters the user makes the most mistakes on.
 */
export function getCharErrorMap(log: KeystrokeEvent[]): Record<string, number> {
  const map: Record<string, number> = {};
  log.forEach((k) => {
    if (!k.correct) {
      map[k.expected] = (map[k.expected] ?? 0) + 1;
    }
  });
  return map;
}

/**
 * Per-word timing breakdown — helps spot words that slow you down.
 */
export function getWordTimings(
  passage: string,
  log: KeystrokeEvent[]
): { word: string; avgMs: number }[] {
  const words = passage.split(" ");
  let charIndex = 0;
  return words.map((word) => {
    const wordLog = log.slice(charIndex, charIndex + word.length);
    charIndex += word.length + 1; // +1 for space
    const avgMs =
      wordLog.length > 0
        ? Math.round(wordLog.reduce((a, k) => a + (k.timestamp ?? 0), 0) / wordLog.length)
        : 0;
    return { word, avgMs };
  });
}