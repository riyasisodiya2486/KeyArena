"use client";

import { useRef, useEffect } from "react";
import type { CharState } from "@/hooks/useTypingEngine";
import { clsx } from "clsx";

interface TypingDisplayProps {
  chars: string[];
  charStates: CharState[];
  cursorIndex: number;
}

export function TypingDisplay({ chars, charStates, cursorIndex }: TypingDisplayProps) {
  const cursorRef = useRef<HTMLSpanElement>(null);

  // Keep cursor in view as user scrolls through long passages
  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursorIndex]);

  return (
    <div
      className="relative font-mono text-[1.1rem] leading-[2.2] tracking-wide
                 bg-surface-2 rounded-xl px-6 py-5 select-none overflow-hidden
                 border border-surface-3"
      style={{ minHeight: "140px", maxHeight: "220px", overflowY: "auto" }}
    >
      {chars.map((char, i) => {
        const state = charStates[i];
        const isCursor = i === cursorIndex;

        return (
          <span
            key={i}
            ref={isCursor ? cursorRef : undefined}
            className={clsx(
              "relative transition-colors duration-[50ms]",
              {
                // Pending — dim
                "text-ink-3":    state === "pending",
                // Correct — bright white
                "text-ink": state === "correct" || state === "current",
                // Wrong — red highlight
                "text-red-400 bg-red-500/10 rounded-[2px]": state === "wrong",
              }
            )}
          >
            {/* Blinking cursor line under current char */}
            {isCursor && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-400
                           rounded-full animate-blink"
              />
            )}
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}

      {/* End-of-text cursor (when all typed) */}
      {cursorIndex === chars.length && (
        <span className="inline-block w-[2px] h-[1.1em] bg-brand-400 
                         align-middle animate-blink ml-0.5" />
      )}
    </div>
  );
}