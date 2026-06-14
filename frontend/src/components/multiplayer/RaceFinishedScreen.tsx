"use client";

import Image from "next/image";
import Link from "next/link";
import type { Standing } from "@/types/race";

const MEDALS = ["🥇", "🥈", "🥉"];

interface RaceFinishedScreenProps {
  standings: Standing[];
  myUserId:  string;
  roomCode:  string;
  onRematch: () => void;
}

export function RaceFinishedScreen({ standings, myUserId, roomCode, onRematch }: RaceFinishedScreenProps) {
  const myResult = standings.find((s) => s.userId === myUserId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fade-up">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">
          {myResult?.rank === 1 ? "🏆" : myResult?.rank === 2 ? "🥈" : myResult?.rank === 3 ? "🥉" : "🏁"}
        </div>
        <h1 className="text-2xl font-bold font-mono text-ink">Race finished!</h1>
        {myResult && (
          <p className="text-ink-2 text-sm mt-2">
            You finished{" "}
            <span className="text-brand-400 font-bold">#{myResult.rank}</span>{" "}
            with <span className="font-mono font-bold text-ink">{myResult.wpm} WPM</span>
          </p>
        )}
      </div>

      {/* Standings */}
      <div className="card overflow-hidden mb-6">
        {standings.map((s, i) => {
          const isMe = s.userId === myUserId;
          return (
            <div
              key={s.userId}
              className={`flex items-center gap-4 px-5 py-4 border-b border-surface-3 last:border-0
                          ${isMe ? "bg-brand-400/5 border-l-2 border-l-brand-400" : ""}`}
            >
              <span className="text-xl w-8 text-center flex-shrink-0">
                {i < 3 ? MEDALS[i] : <span className="font-mono text-sm text-ink-3">#{s.rank}</span>}
              </span>

              {s.image ? (
                <Image src={s.image} alt={s.name} width={36} height={36} className="rounded-full flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-400/20 flex items-center justify-center
                                text-sm font-bold text-brand-400 flex-shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isMe ? "text-brand-400" : "text-ink"}`}>
                    {s.name}
                  </span>
                  {isMe && (
                    <span className="text-[10px] bg-brand-400/15 text-brand-400 px-1.5 py-0.5 rounded font-bold">
                      you
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-3">@{s.username}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`font-mono text-lg font-bold ${i === 0 ? "text-brand-400" : "text-ink"}`}>
                  {s.wpm}
                </p>
                <p className="text-xs text-ink-3">{s.accuracy}% acc</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRematch}
          className="flex-1 btn-ghost py-3"
        >
          ↺ Play again
        </button>
        <Link href="/multiplayer/create" className="flex-1 btn-primary py-3 text-center">
          New room →
        </Link>
      </div>
    </div>
  );
}
