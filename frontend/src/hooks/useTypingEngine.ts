"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { KeystrokeEvent } from "@/lib/db/schema";

export type CharState = "pending" | "correct" | "wrong" | "current";

export type EngineStatus = "idle" | "countdown" | "racing" | "finished";

export interface TypingStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  charsTyped: number;
  errorsCount: number;
  elapsedMs: number;
  progress: number; // 0–100
}

export interface UseTypingEngineReturn {
  status: EngineStatus;
  charStates: CharState[];
  displayCharStates: CharState[];
  displayPassage: string;
  displayCursorIndex: number;
  displayStartIndex: number;
  stats: TypingStats;
  keystrokeLog: KeystrokeEvent[];
  inputValue: string;
  cursorIndex: number;
  currentPassage: string;
  remainingMs: number | null;
  startRace: () => void;
  resetRace: () => void;
  handleInput: (value: string) => void;
}

interface TypingEngineOptions {
  durationSeconds?: number | null;
  windowed?: boolean;
}

const EMPTY_STATS: TypingStats = {
  wpm: 0, rawWpm: 0, accuracy: 100,
  charsTyped: 0, errorsCount: 0, elapsedMs: 0, progress: 0,
};

function calcWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs < 500) return 0;
  const minutes = elapsedMs / 60000;
  return Math.round(correctChars / 5 / minutes);
}

function calcRawWpm(totalChars: number, elapsedMs: number): number {
  if (elapsedMs < 500) return 0;
  const minutes = elapsedMs / 60000;
  return Math.round(totalChars / 5 / minutes);
}

export function useTypingEngine(passage: string, options: TypingEngineOptions = {}): UseTypingEngineReturn {
  const durationMs = options.durationSeconds ? options.durationSeconds * 1000 : null;
  const [currentPassage, setCurrentPassage] = useState(passage);
  const chars = useMemo(() => Array.from(currentPassage), [currentPassage]);
  const windowed = options.windowed ?? false;

  useEffect(() => {
    setCurrentPassage(passage);
  }, [passage]);

  const [status, setStatus]           = useState<EngineStatus>("idle");
  const [inputValue, setInputValue]   = useState("");
  const [stats, setStats]             = useState<TypingStats>(EMPTY_STATS);
  const [keystrokeLog, setKeystrokeLog] = useState<KeystrokeEvent[]>([]);

  const startTimeRef  = useRef<number | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorsRef     = useRef(0);
  const keystrokeRef  = useRef<KeystrokeEvent[]>([]);

  // ── Derived char states ──────────────────────────────────────────────────
  const typedChars = useMemo(() => Array.from(inputValue), [inputValue]);
  const cursorIndex = Math.min(typedChars.length, chars.length);
  const displayStartIndex = windowed ? Math.floor(cursorIndex / 300) * 300 : 0;
  const displayChars = chars.slice(displayStartIndex, displayStartIndex + (windowed ? 780 : chars.length));
  const displayCharStates: CharState[] = displayChars.map((char, localIndex) => {
    const index = displayStartIndex + localIndex;
    if (index < typedChars.length) {
      return typedChars[index] === char ? "correct" : "wrong";
    }
    if (index === typedChars.length) return "current";
    return "pending";
  });
  const charStates = displayCharStates;
  const displayPassage = displayChars.join("");
  const displayCursorIndex = Math.max(0, cursorIndex - displayStartIndex);
  const remainingMs = durationMs === null
    ? null
    : Math.max(0, durationMs - stats.elapsedMs);

  // ── Live stats ticker ────────────────────────────────────────────────────
  const startTicker = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsedMs = durationMs === null
        ? Date.now() - startTimeRef.current
        : Math.min(durationMs, Date.now() - startTimeRef.current);

      setStats((prev) => {
        const correctChars = prev.charsTyped - errorsRef.current;
        return {
          ...prev,
          elapsedMs,
          wpm:    calcWpm(Math.max(0, correctChars), elapsedMs),
          rawWpm: calcRawWpm(prev.charsTyped, elapsedMs),
          progress: durationMs === null ? prev.progress : Math.min(100, Math.round(elapsedMs / durationMs * 100)),
        };
      });

      if (durationMs !== null && elapsedMs >= durationMs) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setKeystrokeLog(keystrokeRef.current);
        setStatus("finished");
      }
    }, 250);
  }, [durationMs]);

  // ── Start race ───────────────────────────────────────────────────────────
  const startRace = useCallback(() => {
    setStatus("racing");
    startTimeRef.current = Date.now();
    errorsRef.current = 0;
    keystrokeRef.current = [];
    setCurrentPassage(passage);
    setInputValue("");
    setStats(EMPTY_STATS);
    setKeystrokeLog([]);
    startTicker();
  }, [startTicker, passage]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetRace = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startTimeRef.current = null;
    errorsRef.current = 0;
    keystrokeRef.current = [];
    setCurrentPassage(passage);
    setStatus("idle");
    setInputValue("");
    setStats(EMPTY_STATS);
    setKeystrokeLog([]);
  }, [passage]);

  // ── Handle input ─────────────────────────────────────────────────────────
  const handleInput = useCallback((value: string) => {
    if (status === "finished") return;

    // The first onChange can fire before startRace state commits;
    // accept it and move to racing so the first character is not dropped.
    if (status === "idle") {
      setStatus("racing");
    }

    const nextChars = Array.from(value);
    const currentChars = Array.from(inputValue);

    // Prevent typing past passage end
    if (nextChars.length > chars.length) return;

    // Auto-start on first keystroke
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
      startTicker();
    }

    const newChar     = nextChars[nextChars.length - 1] ?? "";
    const expected    = chars[nextChars.length - 1] ?? "";
    const isCorrect   = newChar === expected;
    const isDeleting  = nextChars.length < currentChars.length;

    // Record keystroke (only on additions, not backspace)
    if (!isDeleting && newChar) {
      const event: KeystrokeEvent = {
        char:      newChar,
        expected,
        timestamp: Date.now() - (startTimeRef.current ?? Date.now()),
        correct:   isCorrect,
      };
      keystrokeRef.current = [...keystrokeRef.current, event];
    }

    // Track errors (wrong chars ever typed, not current wrong state)
    if (!isDeleting && !isCorrect && newChar) {
      errorsRef.current += 1;
    }

    setInputValue(value);

    const elapsedMs      = startTimeRef.current
      ? durationMs === null ? Date.now() - startTimeRef.current : Math.min(durationMs, Date.now() - startTimeRef.current)
      : 0;
    const correctChars   = nextChars.filter((c, i) => c === chars[i]).length;
    const totalChars     = nextChars.length;
    const errorsCount    = errorsRef.current;
    const accuracy       = totalChars > 0
      ? Math.round(((totalChars - errorsCount) / totalChars) * 100)
      : 100;
    const progress       = durationMs !== null
      ? Math.min(100, Math.round(elapsedMs / durationMs * 100))
      : chars.length > 0
      ? Math.round((totalChars / chars.length) * 100)
      : 100;

    setStats({
      wpm:        calcWpm(correctChars, elapsedMs),
      rawWpm:     calcRawWpm(totalChars, elapsedMs),
      accuracy:   Math.max(0, Math.min(100, accuracy)),
      charsTyped: totalChars,
      errorsCount,
      elapsedMs,
      progress,
    });

    // ── Race finished ──────────────────────────────────────────────────────
    if (nextChars.length === chars.length && durationMs !== null && Date.now() - (startTimeRef.current ?? Date.now()) < durationMs) {
      setCurrentPassage((previous) => `${previous} ${passage}`);
      return;
    }

    if (nextChars.length === chars.length) {
      const finalElapsed  = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      const finalCorrect  = correctChars;
      const finalAcc      = Math.round((finalCorrect / totalChars) * 100);

      setStats({
        wpm:        calcWpm(finalCorrect, finalElapsed),
        rawWpm:     calcRawWpm(totalChars, finalElapsed),
        accuracy:   finalAcc,
        charsTyped: totalChars,
        errorsCount: errorsRef.current,
        elapsedMs:  finalElapsed,
        progress:   durationMs === null ? 100 : Math.min(100, Math.round(finalElapsed / durationMs * 100)),
      });
      setKeystrokeLog(keystrokeRef.current);
      setStatus("finished");
    }
  }, [status, chars, inputValue, startTicker, durationMs, passage]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    status,
    charStates,
    displayCharStates,
    displayPassage,
    displayCursorIndex,
    displayStartIndex,
    stats,
    keystrokeLog,
    inputValue,
    cursorIndex,
    currentPassage,
    remainingMs,
    startRace,
    resetRace,
    handleInput,
  };
}
