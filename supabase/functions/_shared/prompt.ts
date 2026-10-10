export function generationPrompt(brief: Record<string, unknown>, previousIssues: string[] = []) {
  return [
    "Create a solvable Git simulation puzzle about one illustrated chicken.",
    "Return only data matching the supplied JSON schema. Never generate code, SVG, URLs, files, shell behavior, or unsupported Git commands.",
    "Commit changes are semantic accessory changes. Every change.from must equal that property's state at the parent commit.",
    "Build the graph mechanically. Use every required commit ID c1 through cN exactly once. A commit may reference only earlier-numbered commits as parents, so c1 has no parents and the graph is acyclic.",
    "Use exactly these branch names according to branchCount: main, then feature, style, and polish. Include main exactly once. Set currentBranch to main and set repository.head equal to the main branch head.",
    "All branch heads, parent IDs, and provenance source IDs must reference commits that exist in the same response. Never invent prose or Unicode text for an identifier.",
    "The player must finish on main. The private solution must run in the simulator without conflicts and reach the exact target state.",
    "Set target.branch to main. Keep target.branchHeads and target.requiredProvenance empty; the validator checks the final snapshot and branch without requiring a particular generated commit ID.",
    "Before responding, silently replay every solution command from the initial repository. Confirm that each command succeeds, main ends at the target snapshot, and every change.from matches the property value immediately before that change.",
    "Use only git log, git log --all, git switch, git merge, git merge --ff-only, git cherry-pick, and git revert.",
    "Alternative solutions are welcome; the proof solution is only evidence of solvability.",
    "Keep the title under 120 characters, description under 600, and every objective, hint, and commit message under 240 characters. Keep every solution command under 160 characters.",
    "Return exactly the hintCount requested by the persisted brief.",
    "Graph archetypes: fast-forward means a side branch descends from main; divergent-merge means main and a side branch diverge from a shared ancestor; single-transfer uses one distinct side branch; curate-and-undo requires both importing useful work and reverting unwanted work; multi-branch-curation uses at least three branches.",
    `Persisted generation brief: ${JSON.stringify(brief)}`,
    previousIssues.length ? `This is a repair attempt for the SAME persisted brief. Correct every validator failure below while keeping all brief values unchanged:\n- ${previousIssues.join("\n- ")}` : "",
  ].filter(Boolean).join("\n\n");
}
