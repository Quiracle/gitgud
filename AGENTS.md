# AGENTS.md

## Project

Build a daily Git puzzle game with these connected experiences:

- One official AI-generated daily challenge shared by all players.
- An archive of previous daily challenges.
- A Learn Git Basics course of about ten guided puzzles.
- Lower-priority AI-guided practice based on a learner's chosen topic or goal.
- Daily global and friends leaderboards, streaks, achievements, and account management.

The player sees a visual Git graph, a simplified log, current and target illustrated repository states, puzzle objectives, and a terminal-like command input. The player transforms the initial repository into the target by typing Git commands.

This is a **Git simulation game**, not a real Git client.

---

## Primary product principle

Validate the **final repository state and history**, not a predefined sequence of commands.

Multiple valid solutions and command orders must be accepted when they produce a repository satisfying all puzzle invariants. For example, these may both be valid:

```bash
git revert b22
git cherry-pick s14
```

```bash
git cherry-pick s14
git revert b22
```

Do not implement daily or archive puzzles as command-sequence quizzes.

Learn Basics puzzles may require the lesson's featured command, but should still validate the resulting state and relevant provenance rather than exact keystrokes or a full fixed sequence.

---

## Product scope and priority

The hackathon MVP shipped in this order. GitGud is now a production app; keep these priorities when trade-offs arise:

1. Purpose-built Git simulation engine and final-state validation.
2. Playable puzzle screen, command input, restart, and win state.
3. Secure AI generation, validation, and publication of one official daily puzzle.
4. Daily challenge, restart, and browsable challenge archive.
5. Ten static Learn Basics puzzles with saved progress.
6. Google and GitHub sign-in with synced progress.
7. Global daily leaderboard with solve time and restart count.
8. Streaks, achievements, account settings, and result sharing.
9. Friends leaderboard and friend invitations.
10. Topic-based AI-guided lessons as a lower-priority feature.

The official AI-generated daily puzzle is a required core feature. Topic-based AI-guided lessons are not a launch blocker. Do not let social features or a temporary generation-service outage make already-published daily, archive, or Learn Basics puzzles unavailable.

---

## Main user flow

```text
Home (guest play is immediately available)
  -> First visit: "New to Git?"
       -> Yes: Learn Git Basics
       -> No: stay on Home
  -> Optional login
       -> Sign in with Google or GitHub
       -> Validate OAuth callback/session and return to Home
  -> Contextual daily action
       -> Not played: Start daily game
       -> Active: Continue daily game
       -> Surrendered: Try again
       -> Completed: See result and leaderboard
  -> Daily challenge
       -> View command history
       -> View goals and hints
       -> Exit to Home without losing the active attempt
       -> Give up
            -> Try again
            -> Reveal solution/result (assisted, zero points)
       -> Solve
            -> Result popup
                 -> Time, retries, points, and assisted status
                 -> General progression for the last 30 days
                 -> Daily leaderboard
                      -> Global ranking
                      -> Friends ranking
                 -> Share result
                      -> Post to LinkedIn (connect once, then confirm each post)
                      -> Share sheet, copy, or download
                 -> Return Home
  -> Challenge archive
       -> Select a previous date
       -> Play or replay the historical challenge
  -> Guided learning
       -> Learn Git Basics
            -> Lesson list
            -> Guided puzzle
            -> After the final lesson, offer the daily game
       -> AI-guided lessons (lower priority)
            -> Enter a topic or learning goal
            -> Generate and validate a practice lesson
  -> Leaderboard
       -> Global daily ranking
       -> Friends daily ranking
            -> Invite friends
  -> User account
       -> Achievements
       -> Settings
       -> Log out
       -> Delete account
```

Google and GitHub OAuth are accessible from Home. Login is not a prerequisite for playing: guest play must remain possible. Prompt guests to sign in when they try to sync progress, submit a leaderboard result, add friends, or use AI-guided lessons.

The account-validation step is the OAuth callback/session validation state, not a custom email-verification flow. The challenge archive and the randomly selected easy, medium, or hard daily difficulty remain requirements even if they are omitted from a simplified flow diagram.

The Home call to action is derived from durable attempt state, not from temporary component state. Refreshing or returning from a puzzle must preserve whether today's challenge is unplayed, active, surrendered, or completed.

---

## Mobile-first interaction

Design for phones first. Assume the on-screen keyboard can occupy roughly the bottom 40% of the viewport while the terminal input is focused.

- Use dynamic viewport units and safe-area insets; do not rely only on `100vh`.
- Keep the terminal command composer visible above the keyboard.
- Ensure focused input and recent terminal output can scroll into the remaining visible area.
- Put current/target state and the terminal before secondary graph/log detail in the mobile reading order.
- Keep critical controls out of fixed areas that the keyboard can cover.
- Use at least 44px touch targets for primary controls.
- Avoid triggering mobile browser zoom when focusing the command input.
- Test narrow portrait layouts with only about 60% of the normal viewport height available.

---

## Localization

Every new or changed user-facing feature must ship in all three supported languages in the same change:

- English (`en`).
- Catalan (`ca`).
- Spanish (`es`).

Use the existing `src/i18n` catalogs and helpers instead of hard-coding interface copy in React components, hooks, services, or error states. New translation keys must be present in every locale, preserve the same placeholders and markup tags, and pass the locale-parity tests.

This requirement includes navigation, dialogs, buttons, validation and network errors, accessibility labels, result and sharing text, goals, hints, lesson text, and other player-visible copy. Puzzle-specific localized prose should use the appropriate puzzle localization layer without duplicating or changing repository identity, targets, or mechanics.

Git commands, flags, branch names, commit IDs, and other literal Git identifiers stay unchanged unless the surrounding explanatory prose is translated.

---

## Stack

Use:

```text
React
TypeScript
Vite
Tailwind CSS
React state/reducers/context
localStorage
Supabase Auth with Google and GitHub OAuth
Supabase Postgres
Supabase Row Level Security
Supabase Edge Function or database RPC for leaderboard submission
Supabase scheduled function and Edge Function for AI puzzle generation
AI generation API with structured JSON output
LinkedIn "Share on LinkedIn" API through a Supabase Edge Function
Vercel
```

The React app must remain deployable to Vercel as a static Vite build. Supabase is the managed backend service; do not add or deploy a custom application server.

Do not introduce Redux or another global state library unless there is a clear need.

---

## Backend boundary

The Git simulator, puzzle definitions, snapshot calculation, command parser, rendering, and victory validation remain client-side TypeScript.

Supabase is used only for:

- Google/GitHub authentication and user identity.
- Cross-device lesson and challenge progress.
- Attempt metadata and completed solve records.
- Daily leaderboard queries.
- Optional public display names and avatars from OAuth profile metadata.
- Secure server-side generation and publication of the official daily puzzle.
- Lower-priority AI-guided lesson generation.
- LinkedIn connections and posting result cards on a player's behalf.

Do not add:

- FastAPI.
- A custom Node backend.
- Docker infrastructure.
- Server-side Git.
- API calls for executing Git commands or calculating repository state.

Never call the AI provider directly from the browser or expose its API key through a `VITE_` environment variable. The scheduled daily job calls a Supabase Edge Function that owns the secret, requests structured puzzle JSON, validates it, and publishes it. If AI-guided lessons are enabled, the browser also reaches the provider only through an authenticated, rate-limited Edge Function.

Keep a storage/service interface between React and Supabase so guest mode can use localStorage and tests can use an in-memory implementation.

---

## Authentication and privacy

- Support Google and GitHub OAuth through Supabase Auth.
- Support guest play without an account.
- Merge guest progress into the signed-in account after login without erasing newer server progress.
- Never put Supabase service-role credentials in the Vite client. Only public/anonymous client configuration may use `VITE_` environment variables.
- Use Row Level Security for all user-owned data.
- A user may read and modify only their own progress and attempt rows.
- Public leaderboard reads expose only display name, avatar, score, puzzle ID, and fields required for ranking.
- Let a user choose a fallback public display name instead of requiring their full OAuth profile name.
- Do not expose email addresses on leaderboards.

If Supabase is unavailable, the core game and Learn Basics continue in guest mode and save locally. Leaderboard submission may show a friendly unavailable state.

---

## Challenge catalog and history

Daily challenges must not disappear when a new day starts.

Each published challenge has a stable, immutable identity:

```ts
interface PuzzleDefinition {
  id: string;
  version: number;
  kind: "daily" | "lesson" | "generated";
  difficulty: "easy" | "medium" | "hard";
  slug: string;
  title: string;
  description: string;
  publishedOn?: string; // YYYY-MM-DD in UTC for daily puzzles
  initialRepository: Repository;
  target: PuzzleTarget;
  allowedCommands: SupportedCommand[];
  hints?: string[];
  lesson?: LessonMetadata;
}
```

Rules:

- A daily challenge ID and version must continue to resolve to the same puzzle forever.
- Do not mutate a published challenge in a way that invalidates previous results. Publish a new version when a correction is necessary.
- The archive lists every published challenge by date and shows completion status and the user's best result when available.
- Users may open and replay previous challenges.
- Replaying never deletes an earlier completion or best score.
- Daily challenge selection uses a shared canonical date, preferably UTC, so every player receives the same puzzle and difficulty.
- Lessons are bundled static data. Accepted daily definitions are persisted in Supabase and cached locally after publication.
- The daily archive reads the immutable published definitions; it never asks the AI provider to regenerate an old date.

---

## Official AI-generated daily puzzle

AI generation of the official daily puzzle is a **required core feature**.

Exactly one official puzzle is published for each canonical UTC date. Every player receives the same stored puzzle, difficulty, validation target, and leaderboard for that date.

### Difficulty selection

Before generation, the scheduled server process randomly selects exactly one category:

```ts
type PuzzleDifficulty = "easy" | "medium" | "hard";
```

Choose uniformly from the three categories unless a weighted policy is approved. Repeated difficulties on consecutive days are valid. Store the selected difficulty with the date before calling the model and never reroll it because a user refreshes, generation is retried, or the puzzle is replayed.

Suggested difficulty constraints:

- `easy`: one primary Git concept, small graph, short solution, generous hints.
- `medium`: two related concepts, moderate graph, more than one valid solution when possible.
- `hard`: several concepts, larger graph, provenance/history invariants, limited hints.

Difficulty affects puzzle complexity, not which users may play it. The home screen shows today's category before the player starts.

### Daily generation and publication flow

```text
Scheduled daily job, before the new UTC day
  -> choose and persist easy, medium, or hard
  -> Supabase Edge Function
       -> send difficulty and supported-engine constraints to AI generation API
       -> request strict structured JSON
       -> validate schema, safety, graph, commands, and solvability
       -> persist the immutable accepted definition for that UTC date
  -> publish it as the official daily puzzle
  -> serve the same stored definition to every client
```

Do not generate the official daily puzzle on the first player's device or separately per player. The scheduled job should run early enough to allow validation and a bounded retry before publication.

The AI provider is never called directly from the browser. Provider credentials live only in Edge Function secrets.

### Generation contract

The model returns only structured data matching a strict, versioned schema. At minimum it provides:

```ts
interface DailyPuzzleCandidate {
  schemaVersion: number;
  title: string;
  description: string;
  theme: string;
  difficulty: "easy" | "medium" | "hard";
  initialRepository: Repository;
  target: PuzzleTarget;
  allowedCommands: SupportedCommand[];
  hints: string[];
  solutionCommands: string[]; // validation only; never show before completion
}
```

The service creates IDs, date, version, timestamps, and the final `PuzzleDefinition`; do not trust model-generated database IDs, dates, or difficulty. The returned `difficulty` must equal the category already selected by the server.

The model may vary the title, story, labels, commit messages, and illustrated semantic theme using an allowlisted set of existing visual assets and semantic properties. Do not ask it to generate React, JavaScript, SVG, executable code, or arbitrary asset URLs.

### Mandatory validation before play

Reject a generated response unless all of these pass:

- The response matches the schema and size limits exactly.
- Commit IDs and branch names are unique and valid.
- Every parent, branch head, and target reference exists.
- The commit graph is acyclic and within configured commit/branch limits.
- Semantic changes use only supported, allowlisted operations and properties.
- Every allowed and solution command is supported by the simulator.
- Replaying `solutionCommands` from the initial repository completes the puzzle under the normal final-state validator.
- The initial state is not already a winning state.
- No step requires unsupported conflict resolution or detached HEAD behavior.
- User-facing strings satisfy length and content-safety rules.

Use the same engine and final-state validator as hand-authored puzzles. Do not create a second, weaker validator for generated content. If generation or validation fails, make bounded server-side regeneration attempts. If those fail, publish a previously generated and validated AI fallback puzzle of the selected difficulty. Never publish an invalid puzzle or change an already-published puzzle.

### Publication, archive, and ranking

- Persist every accepted daily puzzle with its UTC date, difficulty, schema version, definition, prompt version, generation time, and validation result.
- Enforce one published daily puzzle per UTC date with a database uniqueness constraint.
- Add the published puzzle to the archive immediately and retain it permanently.
- Use its stable puzzle ID and version for progress, streaks, achievements, sharing, and leaderboard entries.
- The official daily puzzle is leaderboard-eligible because every player solves the same immutable definition.
- Keep generation diagnostics private; never expose hidden solution commands before completion.

Never execute arbitrary model output as code.

---

## AI-guided lessons

Topic-based creation belongs inside **Guided Learning** and is lower priority than the official daily game, Learn Basics, authentication, and leaderboard.

A signed-in learner may enter a topic or learning goal and optionally choose a Git command to practise. Reuse the daily generator's strict schema and mandatory validation, then open the normal puzzle screen with additional teaching text and hints.

AI-guided lessons:

- Are personal practice, not official daily challenges.
- Do not affect the daily streak or daily leaderboard.
- May be saved to the learner's lesson history when completed.
- Must use the same allowlisted semantic properties, supported commands, and solvability checks as daily puzzles.
- Must be rate-limited per authenticated user.

If the generation service is unavailable, show a friendly unavailable state; never block daily, archive, or Learn Basics play.

---

## Learn Git Basics

Provide about ten ordered, replayable lessons. Each lesson introduces one command or one distinct behavior:

1. Read history with `git log`.
2. Change branches with `git switch <branch>`.
3. Perform a fast-forward with `git merge <branch>`.
4. Require a fast-forward with `git merge --ff-only <branch>`.
5. Create a merge commit with `git merge <branch>`.
6. Copy one change with `git cherry-pick <commit>`.
7. Undo a change safely with `git revert <commit>`.
8. Replay work with `git rebase <branch>`.
9. Combine commits with `git rebase -i <branch>` using `pick` and `squash`.
10. Complete a short capstone using several learned commands.

Guidelines:

- On a new user's first home visit, show a dismissible **New to Git?** prompt linking here; remember the dismissal.
- Show a short explanation before each puzzle and contextual hints during it.
- Restrict each lesson to commands already introduced where practical.
- Save lesson completion, best solve time, restart count, and hints used.
- Completing a lesson unlocks the next; replaying completed lessons is always allowed.
- The capstone follows normal final-state validation and accepts multiple valid solutions.
- `git checkout <branch>` may be accepted as an alias, but teach `git switch` as preferred.

---

## Puzzle sessions, restart, and timing

Every playable puzzle must have visible **Restart puzzle** and **Give up** actions. The puzzle screen must also expose the current goals and a per-run command history without requiring terminal output to remain on screen forever.

Restart behavior:

- Restore the exact initial repository from the immutable puzzle definition.
- Reset generated commit IDs to the same deterministic session baseline.
- Clear terminal output and any interactive-rebase UI for the current run.
- Keep the current puzzle, help text, and authenticated user.
- Increment the attempt's `restartCount` by one.
- Keep the original attempt start time and continue the same timer.
- Preserve saved completion history and personal bests.
- Ask for confirmation only when the current run has meaningful progress.

For scoring, a retry is an explicit restart. Invalid commands, failed conflict-producing commands, and opening a hint do not increment retries; hints are tracked separately. Restarting resets only the simulated repository and puzzle UI state. It must never reset or reduce elapsed time: after any number of retries, `elapsedMs` is still measured from the first start of that attempt, subject only to the documented hidden-page pause policy.

Giving up marks the run as surrendered and pauses it. Show a result popup that lets the player restart or reveal the solution. Revealing the solution marks that puzzle/date as assisted. The player may still restart and complete it, but the completion earns zero points and is excluded from ranked leaderboard submission. Do not clear the assisted flag by refreshing or restarting.

Record every submitted command in the run transcript, including failed and unsupported commands, its relative timestamp, and its user-facing result. This is the source for the command-history view and optional debugging; it is not a prescribed solution sequence.

Persist an active attempt so refresh, navigation, or restart cannot silently create a faster fresh attempt. The timer may pause when the page is hidden, but its behavior must be consistent and documented. Use cumulative active elapsed time from the initial start.

```ts
interface PuzzleAttempt {
  id: string;
  puzzleId: string;
  puzzleVersion: number;
  userId?: string;
  status: "active" | "surrendered" | "completed" | "abandoned";
  startedAt: string;
  completedAt?: string;
  elapsedMs?: number;
  restartCount: number;
  commandCount: number;
  hintsUsed: number;
  assisted: boolean;
  solutionRevealedAt?: string;
  points?: number;
  commands: AttemptCommand[];
}

interface AttemptCommand {
  command: string;
  elapsedMs: number;
  ok: boolean;
  output: string;
}
```

Do not store a mutable repository graph as the canonical completion record. Store the stable puzzle/version, score metadata, and a compact command transcript or validation proof if useful for debugging.

---

## Progress and result retention

Store and display:

- Completed daily challenges.
- Completed Learn Basics lessons.
- Best solve time per puzzle.
- Restarts/retries for the best result.
- Command count and hints used when available.
- Recent attempts, including replays, without overwriting prior completions.
- Surrendered runs and whether a solution was revealed.
- The command transcript for the active/recent attempt.
- A compact completion/progression summary for the last 30 days.

localStorage is the source for guests and an offline cache for signed-in users. Supabase is the durable cross-device source for signed-in users.

When merging guest and account data:

- Union completion records by puzzle ID and version.
- Keep the best score according to the leaderboard rules.
- Keep the highest unlocked lesson.
- Never replace a completed record with an incomplete one.

Version the localStorage schema and provide migrations or a safe fallback when it changes.

---

## Leaderboard

The primary leaderboard is per daily challenge, not one all-time table. Only authenticated, completed, unassisted attempts may be submitted. Historical challenges retain their own leaderboards. A player who revealed the solution receives zero points and may finish for learning/progress, but that result is not ranked.

Solve time and restart count are the canonical scoring inputs shown in the final flow. Keep the exact points formula in one versioned scoring-policy module so it can be tuned without rewriting stored attempts. Persist the raw inputs even when displaying derived points. Until a points formula is approved, use the deterministic ordering below and do not invent constants in UI components.

Order entries by:

1. Lowest `elapsedMs`.
2. Lowest `restartCount`.
3. Lowest `commandCount`.
4. Earliest completion timestamp.

Display rank, public display name, solve time, restarts/retries, and the current user's row even when it falls outside the first page.

Keep the user's best submitted result for each puzzle version. Replays may improve it but must not make it worse.

Client-side simulation means scores cannot be perfectly cheat-proof. Reduce trivial manipulation by recording a server timestamp when an authenticated attempt starts and validating/submitting completion through a Supabase Edge Function or tightly scoped database RPC. Never claim the leaderboard is fully authoritative while validation runs in the client.

Friends rankings use the same daily score but filter to accepted friends. Support invite links or codes plus explicit acceptance. Never infer or import friendships from Google/GitHub contacts.

---

## Streaks, achievements, and account

### Daily streak

- Show the signed-in user's current streak on the home screen.
- A day counts only when its official puzzle is completed during that puzzle's canonical UTC date.
- Replaying an archived puzzle does not retroactively extend a streak.
- Completing the same daily puzzle more than once counts once.
- Calculate streaks from durable completion dates rather than incrementing an unverified client counter.

### Achievements

Achievements use stable IDs and deterministic rules derived from saved progress, such as first solve, first hard daily, seven-day streak, no-restart solve, or completing Learn Basics. Award them idempotently so refreshing cannot duplicate them.

### Account management

The account area shows profile, achievements, connected OAuth provider, settings, and sign-out. Account deletion requires explicit confirmation and a trusted server-side operation that removes authentication and user-owned progress, attempts, friendships, invitations, and private guided lessons. Remove or anonymize leaderboard entries according to the displayed deletion policy. Deletion also removes LinkedIn connections, pending LinkedIn OAuth states, and the record of LinkedIn posts (posts already published on LinkedIn stay on the member's LinkedIn account). Never place service-role credentials in the client to perform deletion.

---

## Result sharing

Sharing is optional and must not block completion.

Generate text containing the puzzle date or lesson, solve time, retries, and a spoiler-free visual summary. Use the Web Share API when available and a copy-to-clipboard fallback.

### Posting to LinkedIn

Players can post their result card image to LinkedIn directly from GitGud through LinkedIn's **Share on LinkedIn** API product.

- A signed-in player connects LinkedIn once with OAuth 2.0 (authorization code flow), requesting only `openid profile w_member_social`. LinkedIn is a sharing connection, not a GitGud sign-in method. Guests are asked to log in first.
- All LinkedIn calls go through the `linkedin-share` Edge Function. The LinkedIn client secret lives only in Edge Function secrets, and member access tokens are encrypted at rest in service-role-only tables. Never return a LinkedIn token to the browser or put LinkedIn credentials in a `VITE_` variable.
- OAuth `state` is random, single use, short lived, bound to the GitGud user who started the flow, and stored only as a hash. Redirect URIs come from an allowlist.
- Never post automatically or in the background. Every post requires an explicit **Post to LinkedIn** tap after the player has seen the image and caption.
- The caption is editable and defaults to the spoiler-free share text. Never include solution commands.
- The server accepts only PNG images within a size limit and rate-limits posts per user.
- Players can disconnect LinkedIn from the share dialog; disconnecting revokes and deletes the stored token. An expired or revoked token returns the player to **Connect LinkedIn**.
- If LinkedIn or Supabase is unavailable, sharing falls back to the share sheet, copy, download, and LinkedIn's composer link. LinkedIn problems never block completion.

---

## Do not use a real Git engine

Do NOT use:

- `isomorphic-git`.
- `libgit2`.
- A shell.
- Browser filesystem emulation.
- WebAssembly Git implementations.
- Server-side Git.

Implement a small purpose-built Git simulator in TypeScript. Only simulate behavior required by the puzzles.

---

## Git features

### MVP

Implement:

```bash
git switch <branch>
git log
git merge <branch>
git merge --ff-only <branch>
git cherry-pick <commit>
git revert <commit>
```

Optionally accept `git checkout <branch>` as an alias for `git switch`.

### Advanced lessons

Implement after the base game works:

```bash
git rebase <branch>
git rebase -i <branch>
```

Interactive rebase may use a React dialog instead of reproducing a terminal editor. The only required operations are `pick` and `squash`. Do not implement full Git rebase functionality.

Never fake engine behavior: if a lesson's command isn't fully supported, mark that lesson as coming soon.

---

## Explicitly unsupported

Do not implement:

```text
git add
git commit
git push
git pull
git fetch
git stash
git reset
git bisect
git reflog
git tag
remotes
submodules
hooks
staging/index
detached HEAD workflows
real SHA calculation
merge conflict resolution
```

Unsupported commands produce friendly terminal errors.

---

## Conflict handling

There is **no conflict resolution** in this version.

A merge, cherry-pick, rebase, or other operation that produces a semantic conflict fails without modifying the repository:

```text
Merge conflict.

Conflict resolution is not supported in this version.
```

Use simple semantic conflict detection.

---

## Code organization

Keep simulation logic independent from React, authentication, persistence, and leaderboard services.

```text
src/
├── components/
│   ├── GitGraph/
│   ├── GitLog/
│   ├── Terminal/
│   ├── Illustration/
│   ├── GoalPanel/
│   ├── ResultModal/
│   ├── RestartButton/
│   └── Leaderboard/
├── engine/
│   ├── types.ts
│   ├── parser.ts
│   ├── reducer.ts
│   ├── graph.ts
│   ├── snapshot.ts
│   ├── validation.ts
│   └── commands/
│       ├── switch.ts
│       ├── merge.ts
│       ├── cherryPick.ts
│       ├── revert.ts
│       └── rebase.ts
├── puzzles/
│   ├── daily/
│   ├── lessons/
│   ├── generation/
│   │   ├── schema.ts
│   │   └── validateCandidate.ts
│   ├── catalog.ts
│   └── types.ts
├── pages/
│   ├── HomePage.tsx
│   ├── PuzzlePage.tsx
│   ├── ArchivePage.tsx
│   ├── LearnPage.tsx
│   ├── GuidedLearningPage.tsx
│   ├── LeaderboardPage.tsx
│   ├── AccountPage.tsx
│   ├── AchievementsPage.tsx
│   └── AuthCallbackPage.tsx
├── services/
│   ├── auth.ts
│   ├── progress.ts
│   ├── attempts.ts
│   ├── generation.ts
│   └── leaderboard.ts
├── storage/
│   ├── localProgress.ts
│   ├── sync.ts
│   └── schema.ts
├── App.tsx
└── main.tsx

supabase/
├── functions/
│   ├── generate-daily-puzzle/
│   ├── linkedin-share/
│   └── delete-account/
└── migrations/
```

This may be simplified if implementation is cleaner. Service modules must not leak Supabase details into the Git engine.

---

## Repository model

Use a commit DAG:

```ts
interface Repository {
  commits: Record<string, Commit>;
  branches: Record<string, string>;
  currentBranch: string;
  head: string;
}

interface Commit {
  id: string;
  parents: string[];
  message: string;
  changes: SemanticChange[];
  provenance?: CommitProvenance;
}
```

Normal branch state satisfies `repo.head === repo.branches[repo.currentBranch]`. Merge commits may have two parents.

---

## Semantic state and changes

Do not simulate real files. Commits represent changes to an illustrated object.

```ts
interface ChickenState {
  sunglasses: boolean;
  hat: "none" | "blue";
  scarf: "none" | "turquoise";
  crest: "none" | "outline" | "red";
}

type SemanticState = Record<string, unknown>;

interface SetChange {
  type: "set";
  property: string;
  from: unknown;
  to: unknown;
}
```

Do not couple the Git engine to chickens. Use semantic changes for rendering, cherry-picking, reverting, merge conflict detection, rebasing, and squashing.

---

## Snapshot calculation

The visible repository state is derived from commit history:

```ts
getSnapshot(repo: Repository, commitId: string): SemanticState
```

Do not independently mutate a second current illustration state when a command executes. The graph is the source of truth.

---

## Provenance

Generated commits keep metadata describing their origin:

```ts
interface CommitProvenance {
  type:
    | "original"
    | "cherry-pick"
    | "revert"
    | "merge"
    | "rebase"
    | "squash";
  sourceCommits?: string[];
}
```

Examples include `{ type: "cherry-pick", sourceCommits: ["s14"] }`, `{ type: "revert", sourceCommits: ["b22"] }`, and `{ type: "squash", sourceCommits: ["c31", "c32"] }`.

Victory validators may use provenance. Do not depend on generated commit IDs.

---

## Generated IDs

Puzzle commits use readable IDs such as `a10`, `b22`, `c31`, and `s14`. Generated commits may use `g1`, `g2`, `g3`, and so on. There is no need for real Git hashes.

Generation is deterministic within a puzzle run. Restart resets the generator so the same command path produces the same IDs.

---

## Command parser

Parse supported commands into typed actions:

```ts
type GitAction =
  | { type: "switch"; branch: string }
  | { type: "log" }
  | { type: "merge"; branch: string; ffOnly?: boolean }
  | { type: "cherry-pick"; commit: string }
  | { type: "revert"; commit: string }
  | { type: "rebase"; onto: string }
  | { type: "interactive-rebase"; onto: string };
```

Do not execute arbitrary terminal input. Unknown commands fail cleanly.

---

## Engine behavior

- Engine functions are deterministic and side-effect free where practical.
- A command returns a new valid repository or a structured error; failures never partially mutate state.
- Validation receives a repository and puzzle target and returns structured unmet invariants.
- React components do not contain Git graph algorithms.
- Persistence and leaderboard submission happen only after engine validation succeeds.
- Restart reconstructs state from the puzzle definition rather than reversing commands.

---

## Suggested Supabase data model

Keep static lesson definitions in the versioned source catalog. Use Supabase for published daily puzzles and user records:

```text
profiles
  user_id primary key
  display_name
  avatar_url
  created_at

daily_puzzles
  id primary key
  published_on
  version
  is_current
  difficulty
  schema_version
  prompt_version
  definition jsonb
  generated_at
  published_at
  validation_status
  unique (published_on, version)

daily_generation_runs
  id primary key
  published_on
  selected_difficulty
  status
  attempt_number
  error_summary
  created_at

progress
  user_id
  puzzle_id
  puzzle_version
  completed
  best_elapsed_ms
  best_restart_count
  best_command_count
  hints_used
  completed_at
  primary key (user_id, puzzle_id, puzzle_version)

attempts
  id primary key
  user_id
  puzzle_id
  puzzle_version
  status
  started_at
  completed_at
  elapsed_ms
  restart_count
  command_count
  hints_used

leaderboard_entries
  user_id
  puzzle_id
  puzzle_version
  elapsed_ms
  restart_count
  command_count
  completed_at
  primary key (user_id, puzzle_id, puzzle_version)

friendships
  user_id
  friend_user_id
  status
  created_at

friend_invites
  id primary key
  inviter_user_id
  invite_token_hash
  expires_at
  accepted_at

user_achievements
  user_id
  achievement_id
  awarded_at
  primary key (user_id, achievement_id)

linkedin_connections        -- service role only
  user_id primary key
  member_urn
  display_name
  token_ciphertext
  scope
  expires_at

linkedin_oauth_states       -- service role only
  state_hash primary key
  user_id
  return_path
  redirect_uri
  expires_at

linkedin_posts              -- service role only
  id primary key
  user_id
  puzzle_id
  puzzle_version
  post_urn
  status
  created_at
```

Enforce at most one `is_current` daily-puzzle row per date with a partial unique constraint while retaining older corrected versions for historical result integrity. Prefer a database view or RPC for ranked reads. Enforce best-score replacement in the trusted submission boundary, not only in React.

---

## Testing priorities

At minimum, test:

- Parser acceptance and friendly rejection of unsupported commands.
- Snapshot calculation across branches and merge commits.
- Fast-forward and non-fast-forward merge behavior.
- Semantic conflict failure without repository mutation.
- Cherry-pick, revert, rebase, and squash provenance.
- Multiple command orders satisfying the same puzzle.
- Invalid final states being rejected.
- Restart restoring the exact initial repository and incrementing restart count.
- Restart preserving the initial attempt start time and cumulative elapsed time, including after many retries.
- Archive lookup by stable ID, version, and date.
- Daily-candidate schema rejection for malformed, oversized, cyclic, unsupported, or unsafe responses.
- Hidden solution replay proving an AI candidate is solvable with the normal engine.
- Difficulty is selected once per UTC date, persisted, and never rerolled by retries or refreshes.
- Only one immutable official puzzle can be published for a UTC date, including under concurrent jobs.
- Every client receives the same stored puzzle ID, version, and difficulty for a date.
- Failed generation uses a validated AI fallback of the already-selected difficulty.
- AI-guided user input remains plain data and never changes the generation contract if that lower-priority feature is enabled.
- localStorage schema migration and guest-to-account progress merge.
- Leaderboard best-score comparison and tie breakers.
- UTC streak calculation, archive replays not changing streaks, and idempotent achievement awards.
- Friend invite acceptance and friends-only leaderboard filtering.
- Account deletion authorization and cleanup/anonymization behavior.
- LinkedIn posting never happens without an explicit request, tokens never reach the browser, OAuth states are single use and user bound, and failures fall back to copy and download.
- Supabase Row Level Security policies before public deployment.

Do not make network access a requirement for engine tests.

### UI verification ownership

The human user performs all UI verification. AI models and coding agents must not run browser-based, interactive, visual, screenshot, component-UI, or end-to-end UI checks for this project. They may run non-UI unit and integration tests, static analysis, and production builds. When a change affects the interface, report that UI verification remains for the user instead of claiming visual correctness.

---

## Baseline release requirements

The hackathon MVP met these, and every release must keep meeting them:

- The app runs as a static Vite frontend on Vercel.
- A guest can play, restart, and complete puzzles without signing in.
- Final repository state and history determine victory.
- At least the MVP commands work in the simulator.
- Learn Basics has a coherent playable path for every implemented command.
- Today's challenge and previous published challenges are accessible.
- Refreshing does not erase guest progress or a signed-in user's active attempt.
- Google and GitHub sign-in sync completed progress.
- A scheduled server process selects one of `easy`, `medium`, or `hard` and publishes one AI-generated official puzzle for each UTC date.
- Every published daily puzzle is schema-valid and demonstrably solvable with the normal engine before it becomes playable.
- Every player receives the same immutable daily puzzle and difficulty, and previous generated daily puzzles remain in the archive.
- No AI provider or LinkedIn secret is present in the browser bundle or client environment.
- An authenticated completion can appear on the correct daily leaderboard with time and restart count.
- The home screen shows today's difficulty, completion status, and current streak.
- Previously published challenge definitions and results remain available.
- Unsupported commands and unavailable online services fail gracefully.
