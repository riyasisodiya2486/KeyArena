"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  stats: TypingStats;
  keystrokeLog: KeystrokeEvent[];
  inputValue: string;
  cursorIndex: number;
  startRace: () => void;
  resetRace: () => void;
  handleInput: (value: string) => void;
}

const EMPTY_STATS: TypingStats = {
  wpm: 0, rawWpm: 0, accuracy: 100,
  charsTyped: 0, errorsCount: 0, elapsedMs: 0, progress: 0,
};

export function useTypingEngine(passage: string): UseTypingEngineReturn {
  const chars = passage.split("");

  const [status, setStatus]           = useState<EngineStatus>("idle");
  const [inputValue, setInputValue]   = useState("");
  const [stats, setStats]             = useState<TypingStats>(EMPTY_STATS);
  const [keystrokeLog, setKeystrokeLog] = useState<KeystrokeEvent[]>([]);

  const startTimeRef  = useRef<number | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorsRef     = useRef(0);
  const keystrokeRef  = useRef<KeystrokeEvent[]>([]);

  // ── Derived char states ──────────────────────────────────────────────────
  const charStates: CharState[] = chars.map((_, i) => {
    if (i < inputValue.length) {
      return inputValue[i] === chars[i] ? "correct" : "wrong";
    }
    if (i === inputValue.length) return "current";
    return "pending";
  });

  const cursorIndex = Math.min(inputValue.length, chars.length);

  // ── WPM calculation ──────────────────────────────────────────────────────
  // Standard: words = chars / 5, time in minutes
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

  // ── Live stats ticker ────────────────────────────────────────────────────
  function startTicker() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsedMs = Date.now() - startTimeRef.current;

      setStats((prev) => {
        const correctChars = prev.charsTyped - errorsRef.current;
        return {
          ...prev,
          elapsedMs,
          wpm:    calcWpm(Math.max(0, correctChars), elapsedMs),
          rawWpm: calcRawWpm(prev.charsTyped, elapsedMs),
        };
      });
    }, 250);
  }

  // ── Start race ───────────────────────────────────────────────────────────
  const startRace = useCallback(() => {
    setStatus("racing");
    startTimeRef.current = Date.now();
    errorsRef.current = 0;
    keystrokeRef.current = [];
    setInputValue("");
    setStats(EMPTY_STATS);
    setKeystrokeLog([]);
    startTicker();
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetRace = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startTimeRef.current = null;
    errorsRef.current = 0;
    keystrokeRef.current = [];
    setStatus("idle");
    setInputValue("");
    setStats(EMPTY_STATS);
    setKeystrokeLog([]);
  }, []);

  // ── Handle input ─────────────────────────────────────────────────────────
  const handleInput = useCallback((value: string) => {
    if (status !== "racing") return;

    // Prevent typing past passage end
    if (value.length > chars.length) return;

    // Auto-start on first keystroke
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
      startTicker();
    }

    const newChar     = value[value.length - 1] ?? "";
    const expected    = chars[value.length - 1] ?? "";
    const isCorrect   = newChar === expected;
    const isDeleting  = value.length < inputValue.length;

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

    const elapsedMs      = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    const correctChars   = value.split("").filter((c, i) => c === chars[i]).length;
    const totalChars     = value.length;
    const errorsCount    = errorsRef.current;
    const accuracy       = totalChars > 0
      ? Math.round(((totalChars - errorsCount) / totalChars) * 100)
      : 100;
    const progress       = Math.round((value.length / chars.length) * 100);

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
    if (value.length === chars.length) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const finalElapsed  = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      const finalCorrect  = value.split("").filter((c, i) => c === chars[i]).length;
      const finalAcc      = Math.round((finalCorrect / chars.length) * 100);

      setStats({
        wpm:        calcWpm(finalCorrect, finalElapsed),
        rawWpm:     calcRawWpm(chars.length, finalElapsed),
        accuracy:   finalAcc,
        charsTyped: chars.length,
        errorsCount: errorsRef.current,
        elapsedMs:  finalElapsed,
        progress:   100,
      });
      setKeystrokeLog(keystrokeRef.current);
      setStatus("finished");
    }
  }, [status, chars, inputValue]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    status,
    charStates,
    stats,
    keystrokeLog,
    inputValue,
    cursorIndex,
    startRace,
    resetRace,
    handleInput,
  };
}