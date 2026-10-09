# Terra handoff: puzzle schema and validation

Copy the prompt below into a new Codex session using Terra.

---

Work in `C:\Users\jsala\Documents\GitHub\gitgud`.

Read `AGENTS.md` and `ROADMAP.md` completely before editing. Start from the latest `codex/git-simulation-engine` branch, then create and work on a new branch named `codex/puzzle-schema-validation`. Do not modify, delete, rename, or commit unrelated untracked user files such as user-flow images.

Implement roadmap step 1: the headless puzzle schema and validation pipeline. Do not implement UI, authentication, persistence, Supabase, AI API calls, or other roadmap steps.

Requirements:

1. Define a versioned, JSON-serializable runtime schema for puzzle data. It must cover puzzle identity and version, kind, title and description, difficulty, initial repository, allowed commands, hints, a required target branch, complete target semantic state, and optional explicit history invariants.
2. Treat incoming puzzle data as `unknown`. Parse it into trusted TypeScript types or return structured validation issues containing a stable code, human-readable message, and data path.
3. Validate repository structure:
   - Commit and branch names are valid and within documented length limits.
   - Every parent and branch head references an existing commit.
   - The commit graph is acyclic.
   - `head` equals the current branch head.
   - Graph, branch, change, and text sizes stay within configurable limits.
4. Validate semantic content:
   - Only supported semantic change operations are accepted.
   - Properties must come from a supplied allowlist rather than being globally hard-coded to chickens.
   - Change `from` and `to` values must be JSON-serializable.
   - The required target branch exists and its target state contains only allowed properties and values.
5. Validate commands and difficulty:
   - Allowed commands must be supported by the current simulator.
   - Add configurable starting constraints for easy, medium, and hard candidates.
   - Keep difficulty limits in a policy/configuration module, not scattered conditionals.
6. Separate player-facing puzzle data from private validation metadata. A candidate may include hidden `solutionCommands`, but validated public puzzle data must not expose them by default.
7. Prove solvability by replaying hidden solution commands through the existing `executeCommand` engine, starting from a fresh clone of the initial repository. Reject the candidate if parsing or execution fails, a semantic conflict occurs, the solution uses a disallowed command, or the final repository fails the existing target-branch/state/history validator.
8. Reject a puzzle whose initial repository already satisfies the victory target.
9. Reuse the existing engine and validator. Do not duplicate Git behavior or create a weaker AI-only validator.
10. Keep the pipeline independent from React and network APIs so the same modules can later be used by the browser and a Supabase function.

Add focused automated tests for:

- A valid puzzle.
- Missing commits or branch heads.
- Cyclic graphs.
- HEAD/current-branch inconsistency.
- Unsupported commands or semantic operations.
- Disallowed semantic properties or values.
- Oversized graphs and strings.
- An already-solved initial state.
- A hidden solution that conflicts or does not solve the target.
- A valid alternative history satisfying the same final target.
- Confirmation that public validated data omits the hidden solution.

Preserve current engine behavior and tests. Update existing puzzle fixtures to the new schema only where necessary. Avoid UI/browser tests; the user will perform those. Run `pnpm test` and `pnpm build`, fix all failures, and commit the finished work with a focused conventional commit. In the final response report the branch, commit, key files, test count, build result, assumptions, and any deliberately deferred work.

---
