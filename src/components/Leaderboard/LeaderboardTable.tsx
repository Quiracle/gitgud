import { formatElapsed, type LeaderboardEntry } from "../../services/leaderboard";

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No ranked solves yet. Be first.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-3">Rank</th>
            <th className="px-3 py-3">Player</th>
            <th className="px-3 py-3">Time</th>
            <th className="px-3 py-3">Restarts</th>
            <th className="px-3 py-3">Commands</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={`${entry.rank}-${entry.displayName}-${entry.completedAt}`}
              className={entry.isCurrentUser ? "bg-cyan-400/10 text-cyan-100" : "border-t border-slate-800"}
            >
              <td className="px-3 py-3 font-mono font-bold">#{entry.rank}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {entry.avatarUrl ? (
                    <img
                      src={entry.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700 text-xs font-bold">
                      {entry.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="font-semibold">
                    {entry.displayName}{entry.isCurrentUser ? " (you)" : ""}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 font-mono">{formatElapsed(entry.elapsedMs)}</td>
              <td className="px-3 py-3">{entry.restartCount}</td>
              <td className="px-3 py-3">{entry.commandCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
