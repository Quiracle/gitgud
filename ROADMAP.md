# GitGud implementation roadmap

This roadmap prioritizes work that is independent of the final visual design. Each major step should be developed on its own `codex/` feature branch and merged only after its automated checks pass.

## Current baseline

The `codex/git-simulation-engine` branch contains:

- A React, TypeScript, Vite, and Tailwind application shell.
- A purpose-built semantic Git simulator.
- `switch`, the `checkout` alias, `log`, `log --all`, merge, `--ff-only`, cherry-pick, and revert.
- Atomic semantic-conflict failures.
- Commit provenance and deterministic generated IDs.
- Final-state validation that requires the target state at the target branch head and requires the player to finish on that branch.
- A restartable sample puzzle and a temporary mobile-first UI.
- Automated engine tests and a production build.

The UI is provisional. Do not couple new domain logic to the current components.

## Implementation order

### 1. Puzzle schema and validation pipeline

Branch: `codex/puzzle-schema-validation`

Create a versioned, JSON-serializable puzzle contract shared by static lessons, archived daily puzzles, and AI-generated candidates.

The pipeline must:

- Parse untrusted puzzle data into typed structures.
- Validate commit IDs, parent references, branches, HEAD, and an acyclic commit DAG.
- Validate allowlisted semantic properties and changes.
- Require a target branch and complete target semantic state.
- Validate allowed commands and difficulty constraints.
- Keep a hidden solution transcript outside player-facing puzzle data.
- Replay that transcript through the real engine.
- Require the replayed result to satisfy the normal final-state validator.
- Reject puzzles that start solved, require unsupported behavior, conflict during their proposed solution, or exceed size limits.
- Return structured, actionable validation errors.

This step must not add UI, authentication, persistence, or network calls.

### 2. Learn Git Basics catalog

Branch: `codex/learn-basics-catalog`

Create ordered, replayable lesson definitions for:

1. `git log` and `git log --all`.
2. `git switch`.
3. Fast-forward merge.
4. `git merge --ff-only`.
5. Three-way merge.
6. `git cherry-pick`.
7. `git revert`.
8. Rebase.
9. Interactive rebase with pick and squash.
10. A multiple-solution capstone.

All lessons must pass the puzzle-validation pipeline. A lesson may require its featured command, but normal daily puzzles should accept any history that satisfies their invariants.

### 3. Remaining engine behavior

Branch: `codex/rebase-engine`

Implement only the rebase behavior required by lessons:

- `git rebase <branch>`.
- `git rebase -i <branch>`.
- `pick` and `squash` operations.
- Provenance, conflict checks, deterministic IDs, and tests.

Do not implement a general-purpose Git engine or terminal editor.

### 4. Official AI daily generation

Branch: `codex/ai-daily-generation`

Implement the required scheduled daily pipeline:

- Select and persist one random difficulty: easy, medium, or hard.
- Request a structured candidate from the AI provider through a server-side Supabase function.
- Run the shared schema, safety, graph, and solution-replay validation.
- Retry a bounded number of times.
- Fall back to a previously generated and validated AI puzzle of the already-selected difficulty.
- Publish exactly one immutable puzzle for each UTC date.
- Never expose provider secrets or hidden solutions to the browser.

Every player must receive the same stored puzzle and difficulty for a date.

### 5. Progress, attempts, and archive

Branch: `codex/progress-and-archive`

Add versioned localStorage support first, then a persistence interface suitable for Supabase:

- Active attempt recovery.
- Explicit restart counting.
- Cumulative timing from the first attempt start; retries reset puzzle state but never the timer.
- Per-attempt command transcripts, including failed commands and output.
- Give-up/surrender state, controlled solution reveal, and a persistent assisted flag.
- Best result retention.
- Lesson completion.
- A post-course call to action that offers the daily game.
- Historical daily challenge archive.
- Streak calculation from canonical UTC completion dates.
- A compact 30-day progress summary for the result screen.
- A Home daily-action selector for unplayed, active, surrendered, and completed states.
- Guest-to-account merge rules.

### 6. Authentication and account management

Branch: `codex/auth-and-account`

Add Supabase Google and GitHub OAuth, profile settings, logout, and trusted account deletion. Keep guest play available.

### 7. Leaderboards, achievements, and friends

Use separate branches when practical:

- `codex/global-leaderboard`
- `codex/achievements`
- `codex/friends-and-invites`

Implement daily best-score ordering, server-side submission boundaries, deterministic achievements, accepted friendships, invite links, and friends-only ranking filters.

Keep solve time and retries as canonical raw score inputs. Put any derived points formula in a versioned policy module; solution-revealed attempts receive zero points and are excluded from ranked submissions.

### 8. Final mobile visual design

Branch: `codex/mobile-ui-design`

Apply the final design after the core flows stabilize. Assume the software keyboard occupies roughly the bottom 40% of a phone viewport. Keep the command composer visible, use dynamic viewport units and safe-area insets, and place primary puzzle information before secondary graph/log detail.

## Dependency order

```text
Git engine
  -> Puzzle schema and validation
       -> Learn Basics catalog
       -> Rebase engine and advanced lessons
       -> AI daily generation
       -> Progress and archive
            -> Authentication
                 -> Leaderboards, achievements, and friends

Final mobile design can evolve independently once the gameplay contracts stabilize.
```

## Working conventions

- Create one `codex/` branch per feature.
- Keep engine, schema, validation, and puzzle content independent from React.
- Preserve unrelated and untracked user files.
- Use final repository state, target branch state, and explicit history invariants—not fixed command sequences.
- Add regression tests for every reported gameplay bug.
- Run `pnpm test` and `pnpm build` before committing.
- The human user always performs UI checks. AI models and coding agents must not run browser, visual, component-UI, or end-to-end UI tests; they may run non-UI automated tests and production builds.

