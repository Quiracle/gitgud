# Deploy GitGud

**Daily-generation rollout is on hold.** Runtime generation now uses procedurally synthesized, individually certified candidates in a private queue; the eight-template library is retained only for regression fixtures. Historical comparison, a local 90-day season, and owner playtests of two procedural examples have passed. Hosted publication, concurrency, and sustained scheduled refill remain unverified. Do not apply the new candidate-queue migration or enable the gated workflow/schedule in production until the [acceptance gates](docs/procedural-daily-generation.md) are met.

GitGud uses two managed deployments:

- **Vercel** serves the static React/Vite application.
- **Supabase** stores immutable daily puzzles and runs deterministic publication with optional AI-authored story text.

No Docker image or custom server is needed. Docker is only needed if you choose to run Supabase locally; the dashboard-first flow below avoids that requirement.

## 1. Prerequisites

Create accounts for [Supabase](https://supabase.com) and [Vercel](https://vercel.com). An [OpenAI API](https://platform.openai.com) account with billing is optional for AI-authored story text and separate AI-guided lessons; deterministic daily publication works without it.

From this repository, install and verify dependencies and the offline daily mechanics registry:

```powershell
pnpm install
pnpm daily:check
pnpm test
pnpm build
```

`pnpm daily:check` verifies the procedural evaluator's source-bound manifest and rejects stale source. `pnpm daily:certify` updates the legacy template regression registry only; it is not a publication certificate for procedural candidates. The worker binds each private candidate certificate to the exact source fingerprint, candidate mechanics, proof, and evaluator version. Minimum proof lengths are 2/4/6 commands for easy/medium/hard; they are quality thresholds, never player command limits.

The human project owner performs UI checks. These commands do not run browser or visual tests.

For isolated verification of the new reservation SQL without a hosted database, install the optional test runtime into an ignored local directory and run:

```powershell
npm install --prefix daily-review.local/sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.12
node scripts/check-procedural-migration.mjs
node scripts/check-refill-worker.mjs
node scripts/check-procedural-publication.mjs
```

These checks run the actual migration and refill CLI against isolated Postgres, including reserve selection, retry identity, certificate upgrades, incompatible-proof rejection, legacy reservations, input validation, RLS, and role privileges. The publication check applies the daily migration chain and exercises the real publisher/store adapter and publication RPC, checking public/private separation, par metadata, run metadata, fallback story, retries, and refill after an empty queue. The worker's network boundary and the publication check's database client are local adapters; these checks do not test hosted concurrency or replace staging. They add no runtime dependency to the game.

The public-repository-only `.github/workflows/check-daily-generation.yml` runs these checks on pull requests without provider or Supabase secrets. It also starts PostgreSQL already installed on the disposable runner and runs `scripts/check-procedural-concurrency.mjs`, which verifies real concurrent reservation/publication transactions. That script accepts only a fresh local database named `gitgud_generation_check` through `DAILY_SQL_TEST_URL`; never point it at an application database. This CI check passed on 2026-10-29. It verifies SQL coordination, not hosted Supabase/PostgREST deployment or sustained reserve replenishment.

## 2. Create and link Supabase

1. In Supabase, create a project in a nearby region and save its database password.
2. Open **Project Settings → General** and copy the project reference.
3. Authenticate and link this repository:

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
```

4. Build the shared Edge validation bundle. Defer database changes and Edge Function deployment until after the compatible frontend is live:

```powershell
pnpm supabase:bundle
```

The migrations enable Row Level Security. Browser clients can read only published public definitions. Reservation records, certificate data, validation runs, and private proof commands remain private.

### Rollout order for deterministic daily publication

For an existing deployment, first deploy a frontend that accepts optional `localizations.en`, `.ca`, and `.es` fields and still reads legacy definitions. Pause the old generation schedule and let in-flight legacy generation finish before importing history or filling the new queue. Then apply the migration and deploy the compatible `generate-daily-puzzle` Edge Function. Fill the reserve and verify it before enabling the schedule again. This prevents a legacy writer from publishing outside the candidate registry during the history comparison. Once cut over, every new daily comes from that registry, whose uniqueness constraints also cover concurrent publication. Do not keep a legacy or manual publisher running alongside it. For a new project, complete the frontend deployment before enabling daily publication.

### Configure Google and GitHub login

In **Supabase → Authentication → URL Configuration**:

- Set **Site URL** to the production Vercel URL, for example `https://gitgud.example`.
- Add `https://YOUR_VERCEL_DOMAIN/auth/callback` to **Redirect URLs**.
- Add `http://localhost:5173/auth/callback` for local development.
- If OAuth must work on Vercel previews, add the narrow preview wildcard shown in Supabase's Vercel redirect documentation for your team slug.

Copy the Supabase provider callback shown under **Authentication → Providers**. It has this form:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

For Google, create a Web OAuth client in Google Auth Platform. Add the Vercel origin as an authorized JavaScript origin and the Supabase provider callback as an authorized redirect URI. Enable Google in Supabase and paste the client ID and secret.

For GitHub, create an OAuth App. Use the production Vercel URL as its homepage and the same Supabase provider callback as its authorization callback. Enable GitHub in Supabase and paste the client ID and secret.

Provider client secrets belong only in the Supabase dashboard. Do not add them to Vercel or any `VITE_` variable. After the migration is applied, each new OAuth user receives a private `profiles` row protected by Row Level Security.

## 3. Procedural daily publisher (rollout hold)

The runtime Edge Function accepts only individually verified procedural artifacts registered in the private candidate queue. It atomically reserves the date's difficulty and an eligible candidate, replays its private proof through the normal validator, and publishes the immutable puzzle. If a candidate is unavailable it returns `awaiting-candidate`; it does not fall back to a bundled template. AI remains optional localized story text and falls back to deterministic copy.

The refill worker is local/offline by default. For example:

```powershell
node scripts/refill-daily-puzzles.mjs --difficulty medium --target 14
```

It writes private artifacts and a local report under ignored `daily-review.local/candidate-reserve/`. It makes no network calls unless `--upload` is explicitly supplied. Upload requires `DAILY_GENERATION_URL` (HTTPS) and `DAILY_GENERATION_SECRET`; the service checks that worker and deployed evaluator source fingerprints match. Do not upload solution-bearing artifacts as CI workflow artifacts.

The scheduled GitHub Actions workflow `.github/workflows/refill-daily-puzzles.yml` is gated: scheduled runs require repository variable `DAILY_PROCEDURAL_REFILL_ENABLED=true`; manual dispatch is explicit. It runs separate difficulty jobs and uploads to the private queue. This workflow and the SQL migration are implementation work, not evidence that release gates have passed.

Local generation needs no paid staging branch or AI calls. Uploads use the configured existing Supabase project's function and database capacity. A separate hosted staging branch is optional infrastructure and must not be created without approval of its quoted cost. Local SQL and handler tests do not verify hosted concurrency or deployment configuration.

Automatic refill uses standard GitHub Actions Ubuntu runners. `Quiracle/gitgud` was verified public on 2026-10-28; [GitHub documents standard hosted runners as free for public repositories](https://docs.github.com/en/actions/concepts/billing-and-usage). The workflow refuses to run if the repository becomes private, including on manual dispatch, so a visibility change cannot silently switch this worker to billed runner minutes. It does not upload artifacts or enable dependency caches. AI story tokens and usage of the existing Supabase project are separate.

The workflow has three jobs capped at 50 minutes each (up to 150 runner-minutes per invocation, including setup); the worker stops starting new searches after 42 minutes per job and exits earlier when its reserve is ready. Public logs contain aggregate health counts; candidate identities, seeds, operation patterns, and reserved dates stay in private reports. With the enable variable absent or false, scheduled refill jobs do not run. Manual dispatch still starts jobs on a public repository. A manually run local worker is also supported. Changing the runner type or removing the public-repository guard needs a fresh cost review.

The procedural migration is `supabase/migrations/20261028071144_procedural_daily_candidate_queue.sql`; validate it in staging before any production application. No staging publication or release approval is documented yet. The following configuration and rollout steps are conditional on passing the acceptance gates.

Create one long random value for `DAILY_GENERATION_SECRET`. It is not a Supabase key and must never have a `VITE_` prefix.

AI receives limited editorial context and cannot change the repository, target, command allowlist, objectives, hints, or private proof. Invalid or unavailable story output uses the candidate's deterministic localized copy. Existing puzzles remain playable if generation is unavailable.

Set Edge Function secrets for optional story generation:

```powershell
pnpm exec supabase secrets set DAILY_GENERATION_SECRET=YOUR_LONG_RANDOM_SECRET
# Optional story service:
pnpm exec supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY OPENAI_PUZZLE_MODEL=gpt-5.4-mini
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied automatically inside hosted Supabase Edge Functions.

Do not deploy the daily Edge Function or apply its migration yet. Section 6 deploys the frontend first, then runs the migration and Edge deployment together in the required order.

The daily story request uses low reasoning for reasoning models, a 4,096-token output cap, and a 15-second timeout. Non-reasoning models receive temperature 0.7. The older `OPENAI_PUZZLE_REASONING_EFFORT`, `OPENAI_PUZZLE_MAX_OUTPUT_TOKENS`, and `OPENAI_REQUEST_TIMEOUT_MS` settings still apply to guided generation, but do not control the daily story request. `preflight` checks current-source reserve counts (at least 14 per difficulty) and order-independent operation groups (at least four each for medium and hard, none above 35%). It reports story configuration without calling the provider. These operational checks do not establish enjoyment or authorize release.

### Enable LinkedIn posting (optional)

Without these secrets, Share falls back to the share sheet, copy, and download.

1. In the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps), create an app linked to a LinkedIn company page.
2. Under **Products**, add **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**. Together they grant `openid`, `profile`, and `w_member_social`.
3. Under **Auth → Authorized redirect URLs**, add `https://YOUR_PRODUCTION_DOMAIN/linkedin/callback`, plus `http://localhost:5173/linkedin/callback` for local development.
4. Generate a 32-byte token encryption key, for example with `openssl rand -base64 32`. Changing it later disconnects every player.
5. Set the secrets, listing the same redirect URLs comma-separated:

```powershell
pnpm exec supabase secrets set LINKEDIN_CLIENT_ID=YOUR_CLIENT_ID LINKEDIN_CLIENT_SECRET=YOUR_CLIENT_SECRET LINKEDIN_REDIRECT_URIS=https://YOUR_PRODUCTION_DOMAIN/linkedin/callback,http://localhost:5173/linkedin/callback LINKEDIN_TOKEN_KEY=YOUR_BASE64_KEY
```

6. After the frontend-first rollout in section 6, run `pnpm supabase:deploy`; it applies migrations and deploys `linkedin-share` with the other functions.

LinkedIn access tokens last 60 days. When one expires, the share dialog asks the player to connect again.

## 4. Candidate reserve and staging checks

After deploying the migration and compatible function to staging, configure the worker endpoint and private secret in that environment. Fill each difficulty before enabling publication:

```powershell
$env:DAILY_GENERATION_URL = "https://YOUR_STAGING_PROJECT_REF.supabase.co/functions/v1/generate-daily-puzzle"
# Set DAILY_GENERATION_SECRET securely in the process environment.
node scripts/refill-daily-puzzles.mjs --difficulty easy --target 21 --upload
node scripts/refill-daily-puzzles.mjs --difficulty medium --target 21 --upload
node scripts/refill-daily-puzzles.mjs --difficulty hard --target 21 --upload
```

The worker reads every published version and the existing inventory before generation. It preserves certified progress when it reaches a budget, exits unsuccessfully if below target, and never accepts unknown search results. `prepare-reserve` and `seed-fallbacks` are no longer supported by the new publisher. Do not use the old helper.

When deploying a new evaluator fingerprint, the worker reads stale candidates and recertifies their exact stored mechanics and proof. New certificates are appended to `daily_candidate_certificates`; old evidence and candidate/date identity stay intact. Reserved dates are repaired even if the unused reserve already meets its target. An incompatible or inconclusive proof is reported and cannot publish; it must be resolved before rollout. Changes to novelty identity algorithms need their own explicit migration. `--recertify-local` performs the same current search for older local files; the normal upload workflow handles hosted stale candidates automatically.

Generate a staging puzzle manually after the compatible frontend, migration, function and queue are ready:

```powershell
$todayBarcelona = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "Romance Standard Time").ToString("yyyy-MM-dd")
$headers = @{ "x-generation-secret" = $env:DAILY_GENERATION_SECRET; "Content-Type" = "application/json" }
$url = $env:DAILY_GENERATION_URL
$body = @{ mode = "generate"; date = $todayBarcelona } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
```

Confirm one immutable row for the date, no `solutionCommands` in its public definition, and all three localizations. Inspect private candidate/certificate metadata and the run's story source. Test missing story service, simultaneous same-date requests, different-date consumption, empty queue followed by refill, source mismatch, and retry after publication. Story failure must publish the same reserved mechanics with fallback copy. Empty queue must preserve the difficulty and return `awaiting-candidate` without substituting a template.

## 5. Daily schedule (enable only after acceptance)

After the frontend, migration, Edge Function, and reserve are ready, open [supabase/schedule.sql.example](supabase/schedule.sql.example), replace both placeholders, and paste it into **Supabase → SQL Editor**.

- At `23:45` Barcelona time, the primary job generates tomorrow's puzzle.
- At `00:05` Barcelona time, the recovery job requests today's date. The idempotent database constraints make it a no-op when the primary job succeeded.

Daily dates follow Barcelona (`Europe/Madrid`). `pg_cron` runs in UTC, so each job fires at both possible UTC hours and only posts during the intended Barcelona hour; this keeps working across summer and winter time.

Keep the value stored in Vault identical to the `DAILY_GENERATION_SECRET` Edge Function secret.

## 6. Deploy the compatible frontend, then the migration and Edge Function

1. Push the feature branch to GitHub and import the repository in Vercel.
2. Vercel should detect **Vite**. Use:
   - Install command: `pnpm install`
   - Build command: `pnpm build`
   - Output directory: `dist`
3. In **Vercel → Project Settings → Environment Variables**, add:

```text
VITE_DAILY_PUZZLE_SOURCE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Find the publishable key under **Supabase → Project Settings → API Keys**. The legacy anonymous key also works if the dashboard has not migrated to publishable keys. Never put the service-role key, OpenAI key, or LinkedIn client secret in Vercel.

4. Deploy the frontend first. Confirm this release accepts optional three-locale daily text while remaining compatible with legacy daily definitions. The existing `vercel.json` sends application routes such as `/play` and `/course/...` to Vite's `index.html`.

5. Only after acceptance and the compatible frontend is live, apply the database migration and deploy the Edge Functions:

```powershell
pnpm supabase:deploy
```

This command bundles the shared domain, applies migrations, and then deploys the functions. It preserves the required migration-before-Edge order. Next, prepare the reserve in section 4, enable the schedule in section 5, and manually publish a smoke-test date.

## 7. Launch checks

The project owner should verify these in the deployed UI:

- `/play` loads the row for today's date in Barcelona.
- Refreshing `/play` returns the same ID, version, difficulty, and puzzle.
- Restart resets repository state while the original timer continues.
- The course routes still load.
- Narrow mobile layout remains usable with the keyboard open.

Operational checks in Supabase:

- `daily_puzzles` has at most one `is_current` row per date.
- `daily_puzzle_private` contains the proof solution but is unreadable with the public key.
- `daily_generation_runs` records reserved difficulty, candidate ID, mechanics and decision-core hashes, certificate metadata, story source, and validation result. Story-provider diagnostics stay private.
- A mechanics signature mismatch or proof failure prevents publication. A story failure records template copy and still publishes the reserved certified mechanics.
- An authenticated daily run creates one active `attempts` row, then a completion updates `progress` and `leaderboard_entries` through `submit_daily_result`.
- Anonymous users can read the leaderboard RPC but cannot read raw profiles, attempts, transcripts, or progress rows.

## Emergency recovery

If a daily is missing, invoke `generate` manually with that date (Barcelona calendar) using the PowerShell command above. Repeated calls are safe: once a puzzle exists, the function returns `already-published` and does not replace it.

If OpenAI is unavailable, deterministic localized story text is used and reserved certified mechanics still publish. The candidate queue is required: when empty, refill the already selected difficulty and retry the date. Never reroll difficulty or recycle a consumed candidate. Already-published puzzles continue working even when the provider, worker, or scheduled function is down.
