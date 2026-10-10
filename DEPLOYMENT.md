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

## 3. Configure and deploy the generator

Create one long random value for `DAILY_GENERATION_SECRET`. It is not a Supabase key and must never have a `VITE_` prefix.

Set Edge Function secrets:

```powershell
pnpm exec supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY OPENAI_PUZZLE_MODEL=gpt-4.1-mini OPENAI_PUZZLE_TEMPERATURE=1.8 DAILY_GENERATION_SECRET=YOUR_LONG_RANDOM_SECRET
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied automatically inside hosted Supabase Edge Functions.

Deploy:

```powershell
pnpm supabase:deploy
```

The generator sends `temperature: 1.8` and deliberately omits `top_p`. If the configured model rejects temperature or strict structured output, generation fails safely instead of publishing an unvalidated puzzle.

## 4. Create the AI fallback pool

Do this before enabling the schedule. It makes several OpenAI calls and stores at least two validated AI puzzles for each difficulty.

```powershell
$projectRef = "YOUR_PROJECT_REF"
$generationSecret = "YOUR_LONG_RANDOM_SECRET"
$headers = @{ "x-generation-secret" = $generationSecret; "Content-Type" = "application/json" }
$url = "https://$projectRef.supabase.co/functions/v1/generate-daily-puzzle"

Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"seed-fallbacks","perDifficulty":2}'
Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"preflight"}'
```

Do not continue until preflight returns `ready: true`, `temperature: 1.8`, and at least two fallbacks for easy, medium, and hard.

Generate today's puzzle manually as a smoke test:

```powershell
$todayUtc = [DateTime]::UtcNow.ToString("yyyy-MM-dd")
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
