"use client";

interface KeystrokeEvent {
  char: string;
  expected: string;
  timestamp: number;
  correct: boolean;
}

interface RaceSessionRow {
  id: string;
  userId: string;
  passageId: string | null;
  mode: "solo" | "multiplayer" | "competition";
  difficulty: "easy" | "medium" | "hard" | "code";
  wpm: number | null;
  accuracy: number | null;
  timeTakenMs: number | null;
  keystrokeLog: unknown; // Can be cast or ignored for basic table listing
  completedAt: Date | null;
  createdAt: Date;
}

interface PersonalStatsProps {
  sessions: RaceSessionRow[];
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  totalRaces: number;
  totalTimeMs: number;
}

export function PersonalStats({
  sessions,
  avgWpm,
  bestWpm,
  avgAccuracy,
  totalRaces,
  totalTimeMs,
}: PersonalStatsProps) {
  
  // Format total milliseconds into clean minutes/seconds text layout
  function formatTotalTime(ms: number): string {
    if (!ms || ms <= 0) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  return (
    <div className="space-y-10">
      {/* ── Metric Performance Cards Grid ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#161618] border border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-mono text-[#A8A7A3] tracking-wider uppercase">Avg Speed</p>
          <p className="text-2xl font-bold font-mono text-[#E8593C] mt-1">{avgWpm} <span className="text-xs text-[#A8A7A3] font-sans">WPM</span></p>
        </div>

        <div className="bg-[#161618] border border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-mono text-[#A8A7A3] tracking-wider uppercase">High Score</p>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{bestWpm} <span className="text-xs text-[#A8A7A3] font-sans">WPM</span></p>
        </div>

        <div className="bg-[#161618] border border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-mono text-[#A8A7A3] tracking-wider uppercase">Avg Accuracy</p>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{avgAccuracy}<span className="text-sm font-sans">%</span></p>
        </div>

        <div className="bg-[#161618] border border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-mono text-[#A8A7A3] tracking-wider uppercase">Tests Completed</p>
          <p className="text-2xl font-bold font-mono text-[#F2F1EE] mt-1">{totalRaces}</p>
        </div>

        <div className="col-span-2 md:col-span-1 bg-[#161618] border border-neutral-800 rounded-xl px-5 py-4">
          <p className="text-xs font-mono text-[#A8A7A3] tracking-wider uppercase">Practice Time</p>
          <p className="text-lg font-bold font-mono text-[#F2F1EE] mt-2 truncate">{formatTotalTime(totalTimeMs)}</p>
        </div>
      </div>

      {/* ── Recent Race Match History ─────────────────────────────────── */}
      <div className="bg-[#161618] border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 bg-[#1A1A1D]">
          <h2 className="text-sm font-bold font-mono text-[#F2F1EE]">Activity Log</h2>
        </div>

        {sessions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[#6B6A67] font-sans">
            No typing matches found. Go complete a practice match to log metrics!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs text-[#A8A7A3] uppercase tracking-wider font-mono bg-[#0E0E0F]/30">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Mode</th>
                  <th className="px-6 py-3 font-medium">Difficulty</th>
                  <th className="px-6 py-3 font-medium">Speed</th>
                  <th className="px-6 py-3 font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-[#F2F1EE]">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="px-6 py-3 text-xs text-[#A8A7A3]">
                      {session.completedAt ? new Date(session.completedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Unknown'}
                    </td>
                    <td className="px-6 py-3 font-medium capitalize text-xs tracking-wide">
                      {session.mode}
                    </td>
                    <td className="px-6 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        session.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        session.difficulty === 'medium' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        session.difficulty === 'hard' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {session.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-bold font-mono text-[#E8593C]">
                      {session.wpm ?? 0} <span className="text-[10px] font-sans font-normal text-[#A8A7A3]">WPM</span>
                    </td>
                    <td className="px-6 py-3 font-mono text-neutral-300">
                      {session.accuracy ?? 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}