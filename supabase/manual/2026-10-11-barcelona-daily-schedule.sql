-- Moves the existing daily-generation cron jobs from UTC midnight to Barcelona midnight.
-- Run once in Supabase Dashboard -> SQL Editor, before the frontend that uses Barcelona days
-- is deployed. It reuses the Vault secrets created by schedule.sql.example, and cron.schedule
-- replaces jobs with the same name, so nothing else needs to be removed.
--
-- pg_cron runs in UTC and Barcelona is UTC+1 in winter and UTC+2 in summer, so each job fires
-- at both UTC hours and only posts during the intended Barcelona hour.

-- 23:45 in Barcelona: generate tomorrow's puzzle.
select cron.schedule(
  'gitgud-generate-tomorrow',
  '45 21,22 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'gitgud_project_url') || '/functions/v1/generate-daily-puzzle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-generation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gitgud_daily_generation_secret')
    ),
    body := jsonb_build_object(
      'mode', 'generate',
      'date', ((now() at time zone 'Europe/Madrid')::date + 1)::text
    )
  )
  where extract(hour from now() at time zone 'Europe/Madrid') = 23;
  $$
);

-- 00:05 in Barcelona: recover today's puzzle if the previous run failed.
select cron.schedule(
  'gitgud-recover-today',
  '5 22,23 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'gitgud_project_url') || '/functions/v1/generate-daily-puzzle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-generation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gitgud_daily_generation_secret')
    ),
    body := jsonb_build_object(
      'mode', 'generate',
      'date', ((now() at time zone 'Europe/Madrid')::date)::text
    )
  )
  where extract(hour from now() at time zone 'Europe/Madrid') = 0;
  $$
);

-- Check: both jobs exist with the new UTC hours.
select jobname, schedule, active from cron.job where jobname like 'gitgud-%';
