import { branchesAtCommit } from "../../engine/graph";
import type { Repository } from "../../engine";

interface GitGraphProps {
  repository: Repository;
}

export function GitGraph({ repository }: GitGraphProps) {
  const commits = Object.values(repository.commits).reverse();

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-100">Commit graph</h2>
        <span className="font-mono text-xs text-emerald-300">
          HEAD → {repository.currentBranch}
        </span>
      </div>

      <ol className="space-y-0" aria-label="Git commit graph">
        {commits.map((commit, index) => {
          const branches = branchesAtCommit(repository, commit.id);
          const isHead = commit.id === repository.head;
          return (
            <li key={commit.id} className="relative grid grid-cols-[24px_1fr] gap-3 pb-4 last:pb-0">
              {index < commits.length - 1 && (
                <span className="absolute left-[11px] top-5 h-full w-px bg-slate-700" />
              )}
              <span
                className={`relative z-10 mt-1 h-6 w-6 rounded-full border-4 ${
                  isHead
                    ? "border-emerald-300 bg-emerald-500"
                    : "border-slate-700 bg-slate-400"
                }`}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-amber-300">
                    {commit.id}
                  </span>
                  {branches.map((branch) => (
                    <span
                      key={branch}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        branch === repository.currentBranch
                          ? "bg-emerald-400/20 text-emerald-200"
                          : "bg-indigo-400/20 text-indigo-200"
                      }`}
                    >
                      {branch}
                    </span>
                  ))}
                </div>
                <p className="truncate text-sm text-slate-300">{commit.message}</p>
                {commit.parents.length > 1 && (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    parents: {commit.parents.join(", ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
