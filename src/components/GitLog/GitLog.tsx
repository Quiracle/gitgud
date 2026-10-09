import { branchesAtCommit, getReachableCommits } from "../../engine/graph";
import type { Repository } from "../../engine";

export function GitLog({ repository }: { repository: Repository }) {
  const commits = getReachableCommits(repository);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="mb-3 font-semibold text-slate-100">Current log</h2>
      <div className="space-y-3 font-mono text-xs">
        {commits.map((commit) => {
          const branches = branchesAtCommit(repository, commit.id);
          return (
            <article key={commit.id} className="border-l-2 border-slate-700 pl-3">
              <div className="text-amber-300">
                commit {commit.id}
                {branches.length > 0 && (
                  <span className="text-emerald-300"> ({branches.join(", ")})</span>
                )}
              </div>
              <p className="mt-1 text-slate-400">{commit.message}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
