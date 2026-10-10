import { createClient } from "npm:@supabase/supabase-js@2.76.1";
import {
  CHICKEN_V2_SEMANTIC_POLICY,
  createGenerationBrief,
  validateCandidateAgainstBrief,
  validatePuzzleCandidate,
} from "../_shared/domain.bundle.js";
import { materializeCandidate } from "../_shared/openaiSchema.ts";
import { createPreflightRequestBody, createPuzzleRequestBody } from "../_shared/openaiRequest.ts";
import { generationPrompt } from "../_shared/prompt.ts";

type Difficulty = "easy" | "medium" | "hard";
const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  try {
    const config = readConfig();
    if (request.headers.get("x-generation-secret") !== config.generationSecret) {
      return response({ error: "Unauthorized." }, 401);
    }

    const body = await request.json().catch(() => ({})) as {
      mode?: string;
      date?: string;
      perDifficulty?: number;
      difficulty?: Difficulty;
    };
    const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.mode === "preflight") return await preflight(supabase, config);
    if (body.mode === "seed-fallbacks") {
      return await seedFallbacks(supabase, config, body.perDifficulty ?? 2, body.difficulty);
    }
    if (body.mode && body.mode !== "generate") return response({ error: "Unknown mode." }, 400);

    const date = body.date ?? tomorrowUtcDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return response({ error: "date must use YYYY-MM-DD." }, 400);

    const existing = await supabase.from("daily_puzzles").select("id,difficulty").eq("published_on", date).eq("is_current", true).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return response({ status: "already-published", ...existing.data });

    const proposedDifficulty = difficulties[crypto.getRandomValues(new Uint32Array(1))[0] % difficulties.length];
    const proposedSeed = crypto.randomUUID();
    const proposedBrief = createGenerationBrief(date, proposedDifficulty, proposedSeed);
    const reserved = await supabase.rpc("reserve_daily_brief", {
      target_date: date,
      target_difficulty: proposedDifficulty,
      target_seed: proposedSeed,
      target_brief: proposedBrief,
    });
    if (reserved.error) throw reserved.error;
    const brief = reserved.data.brief as Record<string, unknown>;
    const difficulty = reserved.data.selected_difficulty as Difficulty;

    const run = await supabase.from("daily_generation_runs").insert({
      published_on: date,
      selected_difficulty: difficulty,
      status: "running",
      attempt_number: 0,
      model: config.model,
      temperature: config.temperature,
      brief_version: brief.briefVersion,
      prompt_version: brief.promptVersion,
    }).select("id").single();
    if (run.error) throw run.error;

    let previousIssues: string[] = [];
    // Keep the whole generation phase below Supabase's hosted wall-clock limit,
    // while giving a structured puzzle substantially longer than the tiny preflight.
    const generationDeadline = Date.now() + 120_000;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const remainingMs = generationDeadline - Date.now();
      const attemptTimeoutMs = Math.min(config.requestTimeoutMs, remainingMs - 10_000);
      if (attemptTimeoutMs < 10_000) break;
      await supabase.from("daily_generation_runs").update({ attempt_number: attempt }).eq("id", run.data.id);
      try {
        const draft = await requestOpenAI(config, brief, previousIssues, attemptTimeoutMs);
        const candidate = materializeCandidate(draft, date);
        const validation = validateCandidateAgainstBrief(candidate, brief);
        if (validation.ok) {
          return await publish(supabase, run.data.id, candidate, "validated");
        }
        previousIssues = validation.issues.slice(0, 12).map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`);
      } catch (error) {
        previousIssues = [safeError(error)];
      }
    }

    const fallback = await supabase.from("daily_fallback_pool")
      .select("id,candidate,use_count")
      .eq("difficulty", difficulty)
      .eq("validated", true)
      .order("use_count", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallback.error) throw fallback.error;

    if (fallback.data) {
      const candidate = {
        ...fallback.data.candidate,
        id: `daily-${date}`,
        slug: `daily-${date}`,
        version: 1,
        kind: "daily",
        publishedOn: date,
        difficulty,
      };
      const validation = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
      if (validation.ok) {
        await supabase.from("daily_fallback_pool").update({
          use_count: fallback.data.use_count + 1,
          last_used_at: new Date().toISOString(),
        }).eq("id", fallback.data.id);
        return await publish(supabase, run.data.id, candidate, "fallback");
      }
      previousIssues = validation.issues.slice(0, 12).map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`);
    }

    await supabase.from("daily_generation_runs").update({
      status: "failed",
      error_summary: previousIssues.join(" | ").slice(0, 2000),
      completed_at: new Date().toISOString(),
    }).eq("id", run.data.id);
    return response({ error: "No valid puzzle could be published.", difficulty, runId: run.data.id }, 503);
  } catch (error) {
    console.error(safeError(error));
    return response({ error: safeError(error) }, 500);
  }
});

async function publish(supabase: any, runId: string, candidate: any, status: "validated" | "fallback") {
  const { solutionCommands, ...definition } = candidate;
  const published = await supabase.rpc("publish_daily_puzzle", {
    target_run_id: runId,
    target_definition: definition,
    target_solution_commands: solutionCommands,
    target_validation_status: status,
  });
  if (published.error) throw published.error;
  return response({ status: "published", id: published.data, difficulty: definition.difficulty, source: status });
}

async function seedFallbacks(
  supabase: any,
  config: ReturnType<typeof readConfig>,
  desired: number,
  requestedDifficulty?: Difficulty,
) {
  if (!Number.isInteger(desired) || desired < 2 || desired > 10) return response({ error: "perDifficulty must be between 2 and 10." }, 400);
  if (requestedDifficulty && !difficulties.includes(requestedDifficulty)) {
    return response({ error: "difficulty must be easy, medium, or hard." }, 400);
  }

  const counts = await fallbackCounts(supabase);
  const ready = difficulties.every((difficulty) => counts[difficulty] >= desired);
  if (ready) return response({ ready: true, generated: false, counts });

  const difficulty = requestedDifficulty && counts[requestedDifficulty] < desired
    ? requestedDifficulty
    : difficulties
      .filter((candidate) => counts[candidate] < desired)
      .sort((left, right) => counts[left] - counts[right])[0];

  const seed = crypto.randomUUID();
  const brief = createGenerationBrief("2099-01-01", difficulty, seed);
  try {
    const draft = await requestOpenAI(config, brief, [], config.requestTimeoutMs);
    const candidate = materializeCandidate(draft, "2099-01-01");
    const validation = validateCandidateAgainstBrief(candidate, brief);
    if (!validation.ok) {
      return response({
        ready: false,
        generated: false,
        difficulty,
        counts,
        issues: validation.issues.slice(0, 12).map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`),
      });
    }
    const inserted = await supabase.from("daily_fallback_pool").insert({
      difficulty,
      candidate,
      source: "ai",
      validated: true,
    });
    if (inserted.error) throw inserted.error;
    counts[difficulty] += 1;
    return response({
      ready: difficulties.every((candidateDifficulty) => counts[candidateDifficulty] >= desired),
      generated: true,
      difficulty,
      counts,
    });
  } catch (error) {
    return response({
      ready: false,
      generated: false,
      difficulty,
      counts,
      error: safeError(error),
    });
  }
}

async function fallbackCounts(supabase: any): Promise<Record<Difficulty, number>> {
  const result = { easy: 0, medium: 0, hard: 0 };
  for (const difficulty of difficulties) {
    const current = await supabase.from("daily_fallback_pool").select("id", { count: "exact", head: true }).eq("difficulty", difficulty).eq("validated", true);
    if (current.error) throw current.error;
    result[difficulty] = current.count ?? 0;
  }
  return result;
}

async function preflight(supabase: any, config: ReturnType<typeof readConfig>) {
  const counts = await fallbackCounts(supabase);
  let providerCompatible = false;
  let providerError: string | undefined;
  try {
    await verifyProviderConfiguration(config);
    providerCompatible = true;
  } catch (error) {
    providerError = safeError(error);
  }
  return response({
    ready: providerCompatible && difficulties.every((difficulty) => counts[difficulty] >= 2),
    providerCompatible,
    ...(providerError ? { providerError } : {}),
    model: config.model,
    temperature: config.temperature,
    topP: "omitted",
    fallbackCounts: counts,
  });
}

async function verifyProviderConfiguration(config: ReturnType<typeof readConfig>) {
  const request = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${config.openAiKey}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify(createPreflightRequestBody(config)),
  });
  const payload = await request.json();
  if (!request.ok) throw new Error(`OpenAI ${request.status}: ${payload?.error?.message ?? "preflight failed"}`);
}

async function requestOpenAI(
  config: ReturnType<typeof readConfig>,
  brief: Record<string, unknown>,
  previousIssues: string[],
  timeoutMs: number,
) {
  let request: Response;
  try {
    request = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${config.openAiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(createPuzzleRequestBody(config, generationPrompt(brief, previousIssues))),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(`OpenAI puzzle generation exceeded ${Math.round(timeoutMs / 1000)} seconds and was aborted by GitGud.`);
    }
    throw error;
  }
  const payload = await request.json();
  if (!request.ok) throw new Error(`OpenAI ${request.status}: ${payload?.error?.message ?? "request failed"}`);
  const text = payload.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no structured puzzle output.");
  return JSON.parse(text);
}

function readConfig() {
  const value = (name: string) => {
    const result = Deno.env.get(name);
    if (!result) throw new Error(`Missing required secret ${name}.`);
    return result;
  };
  const temperature = Number(Deno.env.get("OPENAI_PUZZLE_TEMPERATURE") ?? "1.8");
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error("OPENAI_PUZZLE_TEMPERATURE must be between 0 and 2.");
  const requestTimeoutMs = Number(Deno.env.get("OPENAI_REQUEST_TIMEOUT_MS") ?? "60000");
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 10_000 || requestTimeoutMs > 90_000) {
    throw new Error("OPENAI_REQUEST_TIMEOUT_MS must be an integer between 10000 and 90000.");
  }
  return {
    supabaseUrl: value("SUPABASE_URL"),
    serviceRoleKey: value("SUPABASE_SERVICE_ROLE_KEY"),
    openAiKey: value("OPENAI_API_KEY"),
    generationSecret: value("DAILY_GENERATION_SECRET"),
    model: Deno.env.get("OPENAI_PUZZLE_MODEL") ?? "gpt-4.1-mini",
    temperature,
    requestTimeoutMs,
  };
}

function tomorrowUtcDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    error.message.toLowerCase().includes("signal timed out")
  );
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
