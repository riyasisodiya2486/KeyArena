"use client";

import Image from "next/image";
import Link from "next/link";

export type LeaderboardEntry = {
  rank:   number;
  userId: string;
  wpm:    number;
  isMe:   boolean;
  user: {
    id:       string;
    username: string | null;
    name:     string | null;
    image:    string | null;
  } | null;
};

interface LeaderboardTableProps {
  entries:  LeaderboardEntry[];
  loading?: boolean;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span className="font-mono text-sm text-ink-3 w-8 text-center inline-block">
      {rank}
    </span>
  );
}

function UserAvatar({ user }: { user: LeaderboardEntry["user"] }) {
  if (!user) {
    return (
      <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center text-xs text-ink-3">
        ?
      </div>
    );
  }
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={user.name ?? "User"}
        width={36}
        height={36}
        className="rounded-full object-cover"
      />
    );
  }
  const initial = (user.name ?? user.username ?? "?").charAt(0).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-brand-400/20 border border-brand-400/30
                    flex items-center justify-center text-sm font-bold text-brand-400">
      {initial}
    </div>
  );
}

export function LeaderboardTable({ entries, loading }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-surface-3 last:border-0">
            <div className="w-8 h-4 bg-surface-3 rounded animate-pulse" />
            <div className="w-9 h-9 bg-surface-3 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-3 bg-surface-3 rounded animate-pulse" />
              <div className="w-20 h-2.5 bg-surface-3 rounded animate-pulse" />
            </div>
            <div className="w-16 h-5 bg-surface-3 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-2xl mb-3">🏁</p>
        <p className="text-ink font-medium mb-1">No scores yet</p>
        <p className="text-sm text-ink-2">
          Complete a race to appear on the leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {entries.map((entry, i) => (
        <div
          key={entry.userId}
          className={`flex items-center gap-4 px-6 py-4 border-b border-surface-3 last:border-0
                      transition-colors hover:bg-surface-2
                      ${entry.isMe ? "bg-brand-400/5 border-l-2 border-l-brand-400" : ""}`}
        >
          {/* Rank */}
          <div className="w-8 flex items-center justify-center flex-shrink-0">
            <RankBadge rank={entry.rank} />
          </div>

          {/* Avatar */}
          <UserAvatar user={entry.user} />

          {/* Name + username */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${entry.isMe ? "text-brand-400" : "text-ink"}`}>
                {entry.user?.name ?? entry.user?.username ?? "Unknown"}
              </span>
              {entry.isMe && (
                <span className="text-xs bg-brand-400/15 text-brand-400 border border-brand-400/30
                                 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                  you
                </span>
              )}
            </div>
            {entry.user?.username && (
              <p className="text-xs text-ink-3 truncate">@{entry.user.username}</p>
            )}
          </div>

          {/* WPM */}
          <div className="text-right flex-shrink-0">
            <div className={`font-mono text-lg font-bold ${
              entry.rank <= 3 ? "text-brand-400" : "text-ink"
            }`}>
              {entry.wpm}
            </div>
            <div className="text-xs text-ink-3">wpm</div>
          </div>

          {/* Profile link */}
          {entry.user?.username && (
            <Link
              href={`/profile/${entry.user.username}`}
              className="flex-shrink-0 text-ink-3 hover:text-ink-2 transition-colors ml-1"
              title="View profile"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
