"use client";

import { useRef, useEffect, useState } from "react";
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
  const cursorChar = chars[cursorIndex];
  const [fontFamily, setFontFamily] = useState("mono");
  const [fontSize, setFontSize] = useState("22");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("keyarena-typing-display") ?? "{}");
      if (["mono", "sans", "serif"].includes(saved.fontFamily)) setFontFamily(saved.fontFamily);
      if (["18", "22", "26", "30"].includes(saved.fontSize)) setFontSize(saved.fontSize);
    } catch {
      // Ignore invalid local preferences and keep the readable defaults.
    }
  }, []);

  function savePreference(next: { fontFamily?: string; fontSize?: string }) {
    const preference = {
      fontFamily: next.fontFamily ?? fontFamily,
      fontSize: next.fontSize ?? fontSize,
    };
    setFontFamily(preference.fontFamily);
    setFontSize(preference.fontSize);
    try { localStorage.setItem("keyarena-typing-display", JSON.stringify(preference)); } catch { /* storage may be disabled */ }
  }

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
  }, [cursorIndex, chars.length, cursorChar]);

  useEffect(() => {
    if (previousWindowRef.current !== windowStartIndex) {
      previousWindowRef.current = windowStartIndex;
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
    }
  }, [windowStartIndex]);

  return (
    <section className="ka-typing-area" aria-label="Typing passage">
      <div className="ka-typing-toolbar">
        <span>DISPLAY SETTINGS</span>
        <label>FONT
          <select aria-label="Typing font family" value={fontFamily} onChange={(event) => savePreference({ fontFamily: event.target.value })}>
            <option value="mono">Mono</option><option value="sans">Sans</option><option value="serif">Serif</option>
          </select>
        </label>
        <label>SIZE
          <select aria-label="Typing font size" value={fontSize} onChange={(event) => savePreference({ fontSize: event.target.value })}>
            <option value="18">18 px</option><option value="22">22 px</option><option value="26">26 px</option><option value="30">30 px</option>
          </select>
        </label>
        <span className="ka-typing-saved">Saved on this device</span>
      </div>
      <div
      ref={viewportRef}
      className={`ka-typing-display ka-font-${fontFamily} relative whitespace-pre-wrap break-words text-[1.1rem] leading-[2.2] tracking-wide
                 bg-surface-2 px-6 py-5 select-none overflow-hidden
                 border border-surface-3`}
      style={{ "--typing-size": `${fontSize}px`, overflowY: "auto" } as React.CSSProperties}
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
    </section>
  );
}
