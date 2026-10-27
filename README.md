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

Daily mechanics come from a deterministic library of offline-certified templates. Each publication selects and reserves one difficulty, template, and seed, verifies its mechanics signature, replays a private proof with the normal simulator, and stores one immutable puzzle per Barcelona calendar date. AI can provide only localized title and description text; missing, malformed, unsafe, or unavailable story output falls back to deterministic English, Catalan, and Spanish copy. AI does not choose or change the graph, target, commands, objectives, hints, or proof.

The offline checks are `pnpm daily:certify` to build/update the certificate registry and `pnpm daily:check` to verify that it still matches the mechanics source. Unknown or stale mechanics are rejected conservatively until certified. The proposed minimum certified solution lengths are 2 commands for easy, 4 for medium, and 6 for hard. These thresholds describe template quality and are not gameplay command limits or scoring rules.

Command count alone is insufficient: medium and hard templates must also have a shortest verified solution that integrates or rebases work. Repetitive predecessor-copy templates are excluded at those levels. The curated library includes branch preparation and bundled changes whose temporary effects can be cleaned up or squashed. All valid player solutions remain accepted, including cherry-picks; this is a generation requirement, not a command restriction.

Run `pnpm daily:review` for a reproducible review pack in the ignored `daily-review.local/` directory. It includes each certified template's graph, initial appearance, target, hints, separate public JSON definitions, and optional solution spoilers. It makes no network calls or database changes. Human playtesting remains necessary to assess enjoyment and UI behavior.

To play these examples locally, generate the pack, then start Vite in review mode (PowerShell):

```powershell
$env:VITE_DAILY_PUZZLE_SOURCE = "review"
$env:VITE_DAILY_REVIEW_TEMPLATE = "medium-5"
pnpm dev
```

Use a guest session in a separate local browser profile. Change the template ID to any ID in the review pack and restart Vite to try another puzzle. Each template has a separate local progress identity. Review mode is development-only, does not publish puzzles, and its local definitions and private proofs are excluded from production builds. Leaderboards and server solution reveal are unavailable for these unpublished examples; the review pack contains optional proof spoilers. Remove the two environment variables to return to the normal source.

Vercel hosts only the static Vite frontend; no Docker image or custom server is required. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the frontend, migration, Edge Function, reserve, cron, and Vercel rollout order. AI-guided practice remains a separate feature with its own puzzle-generation contract.
