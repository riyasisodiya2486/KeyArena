"use client";

import { useEffect, useRef } from "react";
import type { EngineStatus } from "@/hooks/useTypingEngine";

interface TypingInputProps {
  value: string;
  status: EngineStatus;
  onChange: (value: string) => void;
  onStart: () => void;
}

export function TypingInput({ value, status, onChange, onStart }: TypingInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when race starts
  useEffect(() => {
    if (status === "racing") {
      ref.current?.focus();
    }
  }, [status]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Prevent tab from stealing focus
    if (e.key === "Tab") {
      e.preventDefault();
      return;
    }
    // Escape = give up / reset (handled by parent)
    if (e.key === "Escape") {
      ref.current?.blur();
      return;
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    // Strip newlines — Enter key shouldn't add a line
    const val = e.target.value.replace(/\n/g, "");

    if (status === "idle") {
      onStart();
    }
    onChange(val);
  }

  return (
    <div className="relative">
      {/* Invisible textarea — captures all input */}
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={status === "finished"}
        rows={1}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        data-gramm="false"
        className="absolute inset-0 w-full h-full opacity-0 cursor-default resize-none
                   focus:outline-none z-10"
        aria-label="Typing input"
      />

      {/* Click-to-focus overlay shown to user */}
      {status === "idle" && (
        <button
          onClick={() => {
            onStart();
            setTimeout(() => ref.current?.focus(), 50);
          }}
          className="w-full flex items-center justify-center gap-2
                     bg-surface-2 border border-dashed border-surface-4
                     rounded-xl py-5 text-ink-2 text-sm font-medium
                     hover:bg-surface-3 hover:text-ink hover:border-brand-400/50
                     transition-all group"
        >
          <span className="text-lg group-hover:animate-bounce">⌨</span>
          Click here or press any key to start typing
        </button>
      )}

      {status === "racing" && (
        <div
          onClick={() => ref.current?.focus()}
          className="w-full py-3 flex items-center justify-center gap-2
                     text-xs text-ink-3 cursor-text"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          typing active — press Escape to cancel
        </div>
      )}

      {status === "finished" && (
        <div className="w-full py-3 flex items-center justify-center
                        text-xs text-green-400 font-medium">
          ✓ Race complete
        </div>
      )}
    </div>
  );
}