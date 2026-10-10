export function generationPrompt(brief: Record<string, unknown>, previousIssues: string[] = []) {
  return [
    "Create a solvable Git simulation puzzle about one illustrated chicken.",
    "Return only data matching the supplied JSON schema. Never generate code, SVG, URLs, files, shell behavior, or unsupported Git commands.",
    "Commit changes are semantic accessory changes. Every change.from must equal that property's state at the parent commit.",
    "The initial repository must be a valid acyclic DAG. All branches and parents must reference defined commits.",
    "The player must finish on main. The private solution must run in the simulator without conflicts and reach the exact target state.",
    "Use only git log, git log --all, git switch, git merge, git merge --ff-only, git cherry-pick, and git revert.",
    "Alternative solutions are welcome; the proof solution is only evidence of solvability.",
    "Graph archetypes: fast-forward means a side branch descends from main; divergent-merge means main and a side branch diverge from a shared ancestor; single-transfer uses one distinct side branch; curate-and-undo requires both importing useful work and reverting unwanted work; multi-branch-curation uses at least three branches.",
    `Persisted generation brief: ${JSON.stringify(brief)}`,
    previousIssues.length ? `Previous attempt failed for these reasons; correct them: ${previousIssues.join(" | ")}` : "",
  ].filter(Boolean).join("\n\n");
}
