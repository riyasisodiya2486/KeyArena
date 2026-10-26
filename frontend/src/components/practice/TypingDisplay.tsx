"use client";

import { useRef, useEffect } from "react";
import type { CharState } from "@/hooks/useTypingEngine";
import { clsx } from "clsx";

interface TypingDisplayProps {
  chars: string[];
  charStates: CharState[];
  cursorIndex: number;
  windowStartIndex?: number;
}

export function TypingDisplay({ chars, charStates, cursorIndex, windowStartIndex = 0 }: TypingDisplayProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const previousWindowRef = useRef(windowStartIndex);

  // Keep cursor in view as user scrolls through long passages
  useEffect(() => {
    const cursor = cursorRef.current;
    const viewport = viewportRef.current;
    if (!cursor || !viewport) return;

    const cursorRect = cursor.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const bottomLimit = viewportRect.bottom - 76;
    const topLimit = viewportRect.top + 24;
    if (cursorRect.bottom > bottomLimit) {
      viewport.scrollTop += cursorRect.top - topLimit;
    } else if (cursorRect.top < topLimit) {
      viewport.scrollTop -= topLimit - cursorRect.top;
    }
  }, [cursorIndex, chars.length, chars[cursorIndex]]);

  useEffect(() => {
    if (previousWindowRef.current !== windowStartIndex) {
      previousWindowRef.current = windowStartIndex;
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
    }
  }, [windowStartIndex]);

  return (
    <div
      ref={viewportRef}
      className="ka-typing-display relative whitespace-pre-wrap break-words font-mono text-[1.1rem] leading-[2.2] tracking-wide
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
            {char === "\n" ? <br /> : char}
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
