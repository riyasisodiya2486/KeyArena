"use client";

import Image from "next/image";
import Link from "next/link";
import type { Standing } from "@/types/race";

const MEDALS = ["🥇","🥈","🥉"];
const PODIUM_COLORS = ["#E6A817","#A8A7A3","#CD7F32"];

interface FinishScreenProps {
  standings: Standing[];
  myUserId:  string;
  roomCode:  string;
  onRematch: () => void;
}

export function FinishScreen({ standings, myUserId, roomCode, onRematch }: FinishScreenProps) {
  const me = standings.find(s => s.userId === myUserId);

  const winMsg: Record<number, string> = {
    1: "You won! 🔥",
    2: "So close! 🥈",
    3: "Third place! 🥉",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">
          {me?.rank && me.rank <= 3 ? MEDALS[me.rank - 1] : "🏁"}
        </div>
        <h1 className="text-3xl font-bold font-mono text-ink mb-1">
          {me?.rank ? (winMsg[me.rank] ?? `#${me.rank} finish`) : "Race over!"}
        </h1>
        {me && (
          <p className="text-ink-2 text-sm">
            <span className="font-mono font-bold text-ink">{me.wpm} WPM</span>
            {" "}· {me.accuracy}% accuracy
          </p>
        )}
      </div>

      {/* Standings card */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-surface-3">
          <p className="text-xs text-ink-3 uppercase tracking-wider font-medium">Final standings</p>
        </div>

        {standings.map((s, i) => {
          const isMe = s.userId === myUserId;
          return (
            <div key={s.userId}
              className={`flex items-center gap-4 px-5 py-4 border-b border-surface-3 last:border-0
                          transition-colors ${isMe ? "bg-brand-400/5" : "hover:bg-surface-2"}`}
              style={isMe ? { borderLeft: "3px solid #E8593C" } : {}}>

              {/* Medal / rank */}
              <div className="w-8 text-center flex-shrink-0">
                {i < 3
                  ? <span className="text-xl">{MEDALS[i]}</span>
                  : <span className="font-mono text-sm text-ink-3">#{s.rank}</span>}
              </div>

              {/* Avatar */}
              {s.image ? (
                <Image src={s.image} alt={s.name} width={40} height={40} className="rounded-full flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: (PODIUM_COLORS[i] ?? "#303035") + "22",
                    color: PODIUM_COLORS[i] ?? "#A8A7A3",
                  }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-medium truncate ${isMe ? "text-brand-400" : "text-ink"}`}>
                    {s.name}
                  </span>
                  {isMe && (
                    <span className="text-[10px] bg-brand-400/15 text-brand-400
                                     px-1.5 py-0.5 rounded font-bold flex-shrink-0">you</span>
                  )}
                </div>
                <p className="text-xs text-ink-3">@{s.username}</p>
              </div>

              {/* Stats */}
              <div className="text-right flex-shrink-0">
                <p className={`font-mono text-xl font-bold ${i === 0 ? "text-brand-400" : "text-ink"}`}>
                  {s.wpm}
                </p>
                <p className="text-xs text-ink-3">{s.accuracy}% acc</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={onRematch} className="flex-1 btn-ghost py-3 text-sm font-medium">
          ↺ New race
        </button>
        <Link href="/practice" className="flex-1 btn-ghost py-3 text-sm font-medium text-center">
          Solo practice
        </Link>
        <Link href="/leaderboard" className="flex-1 btn-primary py-3 text-sm font-medium text-center">
          Leaderboard →
        </Link>
      </div>
    </div>
  );
}
