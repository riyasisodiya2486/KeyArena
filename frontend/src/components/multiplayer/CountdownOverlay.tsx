"use client";

import { useEffect, useState } from "react";

export function CountdownOverlay({ value }: { value: number }) {
  const [scale, setScale] = useState(1.4);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    setScale(1.4); setOpacity(0);
    const t = setTimeout(() => { setScale(1); setOpacity(1); }, 30);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center
                    bg-surface/90 backdrop-blur-sm select-none">
      <div style={{ transform: `scale(${scale})`, opacity, transition: "all 0.25s cubic-bezier(.34,1.56,.64,1)" }}>
        {value > 0 ? (
          <>
            <div className="font-mono font-bold text-brand-400 text-center leading-none mb-4"
              style={{ fontSize: "clamp(80px, 20vw, 140px)" }}>
              {value}
            </div>
            <p className="text-center text-ink-2 text-xl font-medium">Get ready…</p>
          </>
        ) : (
          <>
            <div className="font-mono font-bold text-green-400 text-center leading-none mb-4"
              style={{ fontSize: "clamp(60px, 15vw, 100px)" }}>
              GO!
            </div>
            <p className="text-center text-ink-2 text-xl font-medium">Type as fast as you can!</p>
          </>
        )}
      </div>
    </div>
  );
}
