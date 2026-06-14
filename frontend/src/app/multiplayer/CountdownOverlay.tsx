"use client";

import { useEffect, useState } from "react";

interface CountdownOverlayProps {
  countdownValue: number; // 3, 2, 1, 0
}

export function CountdownOverlay({ countdownValue }: CountdownOverlayProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(false);
    const t = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(t);
  }, [countdownValue]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-surface/90 backdrop-blur-sm">
      <div className="text-center">
        {countdownValue > 0 ? (
          <>
            <div
              className="font-mono font-bold text-brand-400 transition-all duration-300"
              style={{
                fontSize: "120px",
                lineHeight: 1,
                opacity: animate ? 1 : 0,
                transform: animate ? "scale(1)" : "scale(1.5)",
              }}
            >
              {countdownValue}
            </div>
            <p className="text-ink-2 text-lg mt-4 font-medium">Get ready…</p>
          </>
        ) : (
          <>
            <div
              className="font-mono font-bold text-green-400 transition-all duration-200"
              style={{
                fontSize: "80px",
                lineHeight: 1,
                opacity: animate ? 1 : 0,
                transform: animate ? "scale(1)" : "scale(0.8)",
              }}
            >
              GO!
            </div>
            <p className="text-ink-2 text-lg mt-4 font-medium">Type as fast as you can!</p>
          </>
        )}
      </div>
    </div>
  );
}
