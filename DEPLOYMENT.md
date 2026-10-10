# Deploy GitGud before the hackathon deadline

GitGud uses two managed deployments:

- **Vercel** serves the static React/Vite application.
- **Supabase** stores immutable daily puzzles and runs the scheduled OpenAI generator.

No Docker image or custom server is needed. Docker is only needed if you choose to run Supabase locally; the dashboard-first flow below avoids that requirement.

## 1. Prerequisites

Create accounts for [Supabase](https://supabase.com), [Vercel](https://vercel.com), and the [OpenAI API](https://platform.openai.com). Make sure the OpenAI API project has billing/credits available.

From this repository, install and verify dependencies:

```powershell
pnpm install
pnpm test
pnpm build
```

The human project owner performs UI checks. These commands do not run browser or visual tests.

## 2. Create and link Supabase

1. In Supabase, create a project in a nearby region and save its database password.
2. Open **Project Settings → General** and copy the project reference.
3. Authenticate and link this repository:

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
```

4. Build the shared validation bundle and apply the database migration:

```powershell
pnpm supabase:bundle
pnpm exec supabase db push
```

The migration enables Row Level Security. Browser clients can read only published public definitions. Briefs, validation runs, fallback candidates, and solution commands remain private.

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

## 3. Configure and deploy the generator

Create one long random value for `DAILY_GENERATION_SECRET`. It is not a Supabase key and must never have a `VITE_` prefix.

Set Edge Function secrets:

```powershell
pnpm exec supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY OPENAI_PUZZLE_MODEL=gpt-5.4-mini OPENAI_PUZZLE_REASONING_EFFORT=medium OPENAI_PUZZLE_MAX_OUTPUT_TOKENS=16000 OPENAI_REQUEST_TIMEOUT_MS=90000 DAILY_GENERATION_SECRET=YOUR_LONG_RANDOM_SECRET
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied automatically inside hosted Supabase Edge Functions.

Deploy:

```powershell
pnpm supabase:deploy
```

For GPT-5 models with reasoning enabled, the generator sends `reasoning.effort` and omits incompatible sampling controls such as `temperature` and `top_p`. Legacy non-reasoning models receive the configured temperature instead. If the provider rejects the selected controls or strict structured output, generation fails safely instead of publishing an unvalidated puzzle.

## 4. Create the AI fallback pool

Do this before enabling the schedule. Each Edge Function request generates at most one candidate so it stays below the hosted gateway timeout. The resumable helper repeats those short requests until it has stored at least two validated AI puzzles for each difficulty.

```powershell
$projectRef = "YOUR_PROJECT_REF"
$generationSecret = "YOUR_LONG_RANDOM_SECRET"
& .\scripts\seed-fallbacks.ps1 -ProjectRef $projectRef -GenerationSecret $generationSecret -PerDifficulty 2
```

The helper preserves every successful fallback and can safely be run again if the network or a candidate fails. Do not continue until it returns `ready: true` and at least two fallbacks for easy, medium, and hard.

Generate today's puzzle manually as a smoke test:

```powershell
$todayUtc = [DateTime]::UtcNow.ToString("yyyy-MM-dd")
$headers = @{ "x-generation-secret" = $generationSecret; "Content-Type" = "application/json" }
$url = "https://$projectRef.supabase.co/functions/v1/generate-daily-puzzle"
$body = @{ mode = "generate"; date = $todayUtc } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
```

In **Supabase → Table Editor → daily_puzzles**, confirm there is one row and that its `definition` does not contain `solutionCommands`.

## 5. Enable the daily schedule

Open [supabase/schedule.sql.example](supabase/schedule.sql.example), replace both placeholders, and paste it into **Supabase → SQL Editor**.

- At `23:45 UTC`, the primary job generates tomorrow's puzzle.
- At `00:05 UTC`, the recovery job requests today's date. The idempotent database constraints make it a no-op when the primary job succeeded.

Keep the value stored in Vault identical to the `DAILY_GENERATION_SECRET` Edge Function secret.

## 6. Deploy the frontend to Vercel

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

Find the publishable key under **Supabase → Project Settings → API Keys**. The legacy anonymous key also works if the dashboard has not migrated to publishable keys. Never put the service-role key or OpenAI key in Vercel.

4. Deploy. The existing `vercel.json` sends application routes such as `/play` and `/course/...` to Vite's `index.html`.

## 7. Launch checks

The project owner should verify these in the deployed UI:

- `/play` loads the row for today's UTC date.
- Refreshing `/play` returns the same ID, version, difficulty, and puzzle.
- Restart resets repository state while the original timer continues.
- The course routes still load.
- Narrow mobile layout remains usable with the keyboard open.

Operational checks in Supabase:

- `daily_puzzles` has at most one `is_current` row per date.
- `daily_puzzle_private` contains the proof solution but is unreadable with the public key.
- `daily_generation_runs` records model, temperature, attempts, and validation result.
- Failed generation uses a fallback of the already-reserved difficulty.

## Emergency recovery

If a daily is missing, invoke `generate` manually with that UTC date using the PowerShell command above. Repeated calls are safe: once a puzzle exists, the function returns `already-published` and does not replace it.

If OpenAI is unavailable, a ready fallback pool still publishes a validated puzzle. Already-published puzzles continue working even when OpenAI or the scheduled function is down.
