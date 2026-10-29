# GitGud

A browser-based daily game for learning Git by transforming simulated repositories.

The first implementation includes a purpose-built TypeScript Git engine and a basic puzzle UI. It does **not** execute real Git commands or access a filesystem.

## Supported simulator commands

```text
git switch <branch>
git checkout <branch>
git log
git log --all
git merge <branch>
git merge --ff-only <branch>
git cherry-pick <commit>
git revert <commit>
git rebase <branch>
git rebase -i <branch>
```

Interactive rebase opens a dialog instead of a text editor and supports only `pick` and `squash`, keeping commits in their original order. In transcripts and hidden solutions, the edited todo list is stored as extra lines after the command, for example `git rebase -i main\npick c31\nsquash c32`.

## Local development

```bash
pnpm install
pnpm dev
```

Run verification with:

```bash
pnpm test
pnpm build
```

The UI is intentionally foundational and will be redesigned separately. Simulation code lives under `src/engine` and does not depend on React.

By default, local development uses a validated bundled daily fixture. Copy `.env.example` to `.env.local` if you want to select the source explicitly.

## Daily challenge generation and deployment

**Release status: deployed on 2026-10-29.** The procedural publisher uses source-bound certificates and a private candidate queue; eight legacy templates remain regression fixtures only. The approved production smoke test published the 2026-10-30 puzzle, verified public localized access and immutable retry behavior, and preserved all earlier definitions. Daily jobs and automatic refill are enabled; the initial hosted refill run passed for all difficulties. See [the generation evidence and rollout record](docs/procedural-daily-generation.md).

`pnpm daily:check` verifies the procedural evaluator source manifest and legacy regression registry; it does not search new candidates. `pnpm daily:certify` updates that legacy registry only. The private refill worker runs locally without network access by default and saves individually verified candidate artifacts under ignored `daily-review.local/candidate-reserve/`. Upload is explicit (`--upload`), requires `DAILY_GENERATION_URL` and `DAILY_GENERATION_SECRET`, and compares candidates with every published version and the private inventory. The Edge Function verifies candidate certificates and proofs, reserves one candidate per date, and publishes immutable mechanics; optional AI story output affects only localized title and description, with deterministic localized fallback.

Run `pnpm daily:refill --difficulty medium --target 14`, followed by `node scripts/review-procedural-puzzles.mjs`, for new procedural examples. The spoiler-free `daily-review.local/procedural-review.md` links individual public review definitions. `pnpm daily:review` remains available for the eight legacy regression fixtures. Neither review command makes network calls or database changes. Human playtesting remains necessary to assess enjoyment and UI behavior.

To play these examples locally, generate the pack, then start Vite in review mode (PowerShell):

```powershell
$env:VITE_DAILY_PUZZLE_SOURCE = "review"
$env:VITE_DAILY_REVIEW_TEMPLATE = "medium-5"
pnpm dev
```

Use a guest session in a separate local browser profile. In review mode, `/play?review=ID` selects another generated public file without restarting Vite; use an ID from the review pack. Each puzzle has separate local progress. Review mode is development-only, does not publish puzzles, and its local definitions and private proofs are excluded from production builds. Leaderboards and server solution reveal are unavailable for these unpublished examples. Remove the two environment variables to return to the normal source.

Vercel hosts only the static Vite frontend; no Docker image or custom server is required. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the frontend-first rollout order. AI-guided practice remains a separate feature with its own puzzle-generation contract.
