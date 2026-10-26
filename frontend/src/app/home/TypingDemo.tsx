"use client";

import { useEffect, useRef, useState } from "react";

const passage = "The fastest way forward is to find your rhythm, trust your hands, and let every keystroke count.";

export function TypingDemo() {
  const [count, setCount] = useState(0);
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = demoRef.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = false;
    let timer: number | undefined;
    const start = () => {
      if (visible && !document.hidden && timer === undefined) {
        timer = window.setInterval(() => setCount((value) => value >= passage.length ? 0 : value + 1), 240);
      }
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0.25 });
    observer.observe(node);
    const onVisibilityChange = () => document.hidden ? stop() : start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <div className="ka-demo" ref={demoRef} aria-label="Illustrative typing demonstration">
    <div className="ka-demo-top"><span><i /> DEMO SESSION</span><span>SOLO / MEDIUM</span></div>
    <div className="ka-passage" aria-hidden="true">{passage.split("").map((char, i) => <span key={i} className={i < count ? "is-done" : i === count ? "is-current" : ""}>{char}</span>)}</div>
    <div className="ka-demo-bottom"><div><small>PACE</small><strong>{Math.min(42 + Math.floor(count / 7), 68)}<em> WPM</em></strong></div><div><small>ACCURACY</small><strong>98.6<em>%</em></strong></div><div className="ka-progress"><small>RACE PROGRESS</small><b><i style={{ width: `${Math.round(count / passage.length * 100)}%` }} /></b></div></div>
    <div className="ka-demo-note">Illustrative session · your race starts in Practice</div>
  </div>;
}
