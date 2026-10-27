# Deploy GitGud before the hackathon deadline

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

`pnpm daily:certify` computes offline search certificates for the approved deterministic template registry. Run it when intentionally changing the engine, deterministic generator, or evaluator; review the resulting registry and then run `pnpm daily:check`. The check rejects stale fingerprints, missing certificates, unknown templates, and inconclusive searches. Proposed minimum solution lengths are 2/4/6 commands for easy/medium/hard. They are certification quality thresholds only; the player's command count is not restricted by them.

The human project owner performs UI checks. These commands do not run browser or visual tests.

For isolated verification of the new reservation SQL without a hosted database, install the optional test runtime into an ignored local directory and run:

```powershell
npm install --prefix daily-review.local/sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.12
node scripts/check-daily-migration.mjs
```

This checks the actual migration against a minimal predecessor schema, including reserve selection, retry identity, legacy reservations, input validation, RLS, and role privileges. It does not test hosted concurrency or replace a staging rollout. It adds no runtime dependency to the game.

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

For an existing deployment, first deploy a frontend that accepts optional `localizations.en`, `.ca`, and `.es` fields and still reads legacy definitions. Then apply the database migration, and deploy the compatible `generate-daily-puzzle` Edge Function. Only after those steps should you prepare the mechanics reserve or enable the schedule. This ordering prevents clients that do not understand localized definitions from receiving them. For a new project, complete the frontend deployment before enabling daily publication.

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

## 3. Configure the daily publisher

Create one long random value for `DAILY_GENERATION_SECRET`. It is not a Supabase key and must never have a `VITE_` prefix.

The daily publisher always constructs mechanics from the certified deterministic library. AI is used only for optional title and description text in English, Catalan, and Spanish. It receives a limited editorial context and cannot change the repository, target, command allowlist, objectives, hints, or private proof. Story output is strictly checked; any missing, unsafe, malformed, or unavailable response uses the matching deterministic template copy. Existing and newly published puzzles remain playable if the story provider is unavailable.

Set Edge Function secrets for optional story generation:

```powershell
pnpm exec supabase secrets set DAILY_GENERATION_SECRET=YOUR_LONG_RANDOM_SECRET
# Optional story service:
pnpm exec supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY OPENAI_PUZZLE_MODEL=gpt-5.4-mini
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied automatically inside hosted Supabase Edge Functions.

Do not deploy the daily Edge Function or apply its migration yet. Section 6 deploys the frontend first, then runs the migration and Edge deployment together in the required order.

The daily story request uses low reasoning for reasoning models, a 4,096-token output cap, and a 15-second timeout. Non-reasoning models receive temperature 0.7. The older `OPENAI_PUZZLE_REASONING_EFFORT`, `OPENAI_PUZZLE_MAX_OUTPUT_TOKENS`, and `OPENAI_REQUEST_TIMEOUT_MS` settings still apply to guided generation, but do not control the daily story request. The `preflight` mode reports whether the bundled mechanics registry is present, current reserve counts, and whether story generation is configured. It does not call OpenAI or verify provider availability; story failures fall back to template copy.

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

## 4. Prepare the certified mechanics reserve

After completing section 6, the reserve stores certified deterministic template selections and seeds, not AI-generated repository candidates. It is optional for publication: the daily function can select a certified template directly if the reserve is empty. Prepare the default 14 mechanics per difficulty before enabling the schedule:

```powershell
$projectRef = "YOUR_PROJECT_REF"
$generationSecret = "YOUR_LONG_RANDOM_SECRET"
& .\scripts\seed-fallbacks.ps1 -ProjectRef $projectRef -GenerationSecret $generationSecret
```

The helper checks `preflight`, then uses `prepare-reserve` until each difficulty reaches the requested count. `seed-fallbacks` is a compatibility alias for `prepare-reserve`. The helper is resumable and preserves successful rows. Preflight readiness means the mechanics registry is valid; it does not mean AI story generation has been tested or that the reserve is full. The final output displays counts and the `storyAvailable` configuration indicator.

Generate today's puzzle manually as a smoke test after the compatible frontend, migration, and Edge Function are deployed:

```powershell
$todayBarcelona = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "Romance Standard Time").ToString("yyyy-MM-dd")
$headers = @{ "x-generation-secret" = $generationSecret; "Content-Type" = "application/json" }
$url = "https://$projectRef.supabase.co/functions/v1/generate-daily-puzzle"
$body = @{ mode = "generate"; date = $todayBarcelona } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
```

In **Supabase → Table Editor → daily_puzzles**, confirm there is one row for the date, its `definition` does not contain `solutionCommands`, and it has all three localized text entries. Inspect the linked private `daily_generation_runs` row for the template, mechanics signature, difficulty certificate, and story source. Test story failure on a staging project; it must still publish a validated daily with template copy.

## 5. Enable the daily schedule after section 6

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

5. Only after the frontend is live, apply the database migration and deploy the Edge Functions:

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
- `daily_generation_runs` records reserved difficulty, template ID, mechanics signature, certificate quality metrics, story source, and validation result. Story-provider diagnostics stay private.
- A mechanics signature mismatch or proof failure prevents publication. A story failure records template copy and still publishes the reserved certified mechanics.
- An authenticated daily run creates one active `attempts` row, then a completion updates `progress` and `leaderboard_entries` through `submit_daily_result`.
- Anonymous users can read the leaderboard RPC but cannot read raw profiles, attempts, transcripts, or progress rows.

## Emergency recovery

If a daily is missing, invoke `generate` manually with that date (Barcelona calendar) using the PowerShell command above. Repeated calls are safe: once a puzzle exists, the function returns `already-published` and does not replace it.

If OpenAI is unavailable, deterministic template story text is used and certified mechanics still publish; the mechanics reserve is optional. Already-published puzzles continue working even when OpenAI or the scheduled function is down.
