import { createClient } from "npm:@supabase/supabase-js@2.76.1";
import {
  CHICKEN_V2_SEMANTIC_POLICY,
  createGuidedBrief,
  normalizeGuidedGoal,
  toGuidedPuzzle,
  validateCandidateAgainstBrief,
  validatePuzzleCandidate,
} from "../_shared/domain.bundle.js";
import { materializeCandidate } from "../_shared/openaiSchema.ts";
import { createPuzzleRequestBody, parsePuzzleResponsePayload } from "../_shared/openaiRequest.ts";
import { generationPrompt } from "../_shared/prompt.ts";

/**
 * AI-guided practice: a signed-in learner describes what they find hard and gets a
 * personal puzzle built by the daily generator's brief, prompt, schema, and validator.
 * The learner's text is plain data. Results are private practice, never ranked.
 */

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "content-type": "application/json; charset=utf-8" };

/** Per-user limits. Every request counts, including failures, so retries can't spin the provider. */
const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 20;
const MAX_ATTEMPTS = 2;
/** Prose languages the app ships. The value is what the model is told to write in. */
const LANGUAGES: Record<string, string> = { en: "English", es: "Spanish (Spain)", ca: "Catalan" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  let config: ReturnType<typeof readConfig>;
  try {
    config = readConfig();
  } catch (error) {
    console.error(safeError(error));
    return response({ error: "Personalised puzzles aren't available right now." }, 503);
  }
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return response({ error: "Sign in to build a personalised puzzle." }, 401);

  const body = await request.json().catch(() => ({})) as { goal?: unknown; locale?: unknown };
  const goal = normalizeGuidedGoal(body.goal);
  const locale = typeof body.locale === "string" && Object.hasOwn(LANGUAGES, body.locale) ? body.locale : "en";
  if (!goal) return response({ error: "Tell us what you'd like to practise, in up to 200 characters." }, 400);

  let lessonId: string | undefined;
  try {
    const limited = await rateLimited(supabase, user.id);
    if (limited) return response({ error: limited }, 429);

    const date = new Date().toISOString().slice(0, 10);
    const { brief, focus } = createGuidedBrief(goal, date, crypto.randomUUID());
    const inserted = await supabase.from("guided_lessons").insert({
      user_id: user.id,
      goal,
      topic: focus.topic,
      difficulty: focus.difficulty,
      status: "running",
      model: config.model,
    }).select("id").single();
    if (inserted.error) throw inserted.error;
    lessonId = inserted.data.id as string;

    let previousIssues: string[] = [];
    const deadline = Date.now() + 110_000;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const timeoutMs = Math.min(config.requestTimeoutMs, deadline - Date.now() - 5_000);
      if (timeoutMs < 15_000) break;
      try {
        const draft = await requestOpenAI(config, brief, previousIssues, { goal, topic: focus.topic, language: LANGUAGES[locale] }, timeoutMs);
        const candidate = materializeCandidate(draft, date, brief);
        const validation = validateCandidateAgainstBrief(candidate, brief);
        // The story-theme check looks for the theme's English keyword, which translated prose won't contain.
        if (locale !== "en") validation.issues = validation.issues.filter((issue: { code: string }) => issue.code !== "brief.story-theme");
        if (validation.issues.length === 0) {
          return await accept(supabase, lessonId, goal, focus.topic, candidate, "generated", attempt);
        }
        previousIssues = validation.issues.slice(0, 12).map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`);
      } catch (error) {
        previousIssues = [safeError(error)];
      }
    }

    // The provider didn't produce a valid puzzle in time: reuse a validated AI puzzle of
    // the same difficulty so the learner still gets practice.
    const fallback = await supabase.from("daily_fallback_pool")
      .select("candidate")
      .eq("difficulty", focus.difficulty)
      .eq("validated", true)
      .limit(10);
    if (fallback.error) throw fallback.error;
    const pool = fallback.data ?? [];
    if (pool.length) {
      const picked = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length].candidate;
      return await accept(supabase, lessonId, goal, focus.topic, picked, "fallback", MAX_ATTEMPTS);
    }

    await supabase.from("guided_lessons").update({
      status: "failed",
      attempt_count: MAX_ATTEMPTS,
      error_summary: previousIssues.join(" | ").slice(0, 2000),
      completed_at: new Date().toISOString(),
    }).eq("id", lessonId);
    return response({ error: "We couldn't build a valid puzzle this time. Please try again in a minute." }, 503);
  } catch (error) {
    console.error(safeError(error));
    if (lessonId) {
      await supabase.from("guided_lessons").update({
        status: "failed",
        error_summary: safeError(error),
        completed_at: new Date().toISOString(),
      }).eq("id", lessonId);
    }
    return response({ error: "We couldn't build your puzzle. Please try again." }, 500);
  }
});

async function accept(
  supabase: any,
  lessonId: string,
  goal: string,
  topic: string,
  candidate: any,
  status: "generated" | "fallback",
  attempts: number,
) {
  const { puzzle, solutionCommands } = toGuidedPuzzle(candidate, lessonId);
  // Same engine replay and invariants as every published puzzle, on the final shape.
  const validation = validatePuzzleCandidate({ ...puzzle, solutionCommands }, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validation.ok) throw new Error(`Guided puzzle failed final validation: ${validation.issues[0]?.message ?? "unknown"}`);

  const saved = await supabase.from("guided_lessons").update({
    status,
    attempt_count: attempts,
    definition: puzzle,
    solution_commands: solutionCommands,
    completed_at: new Date().toISOString(),
  }).eq("id", lessonId);
  if (saved.error) throw saved.error;
  return response({ id: lessonId, goal, topic, personalized: status === "generated", puzzle });
}

async function rateLimited(supabase: any, userId: string): Promise<string | undefined> {
  const count = async (sinceMs: number) => {
    const result = await supabase.from("guided_lessons")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - sinceMs).toISOString());
    if (result.error) throw result.error;
    return result.count ?? 0;
  };
  const running = await supabase.from("guided_lessons")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "running")
    .gte("created_at", new Date(Date.now() - 3 * 60_000).toISOString());
  if (running.error) throw running.error;
  if ((running.count ?? 0) > 0) return "Your last puzzle is still being built. Give it a moment.";
  if (await count(60 * 60_000) >= HOURLY_LIMIT) return `You can build ${HOURLY_LIMIT} puzzles an hour. Try again a little later.`;
  if (await count(24 * 60 * 60_000) >= DAILY_LIMIT) return `You've built ${DAILY_LIMIT} puzzles today. Come back tomorrow!`;
  return undefined;
}

async function requestOpenAI(
  config: ReturnType<typeof readConfig>,
  brief: Record<string, unknown>,
  previousIssues: string[],
  learner: { goal: string; topic: string },
  timeoutMs: number,
) {
  const request = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${config.openAiKey}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(createPuzzleRequestBody(config, generationPrompt(brief, previousIssues, learner), brief)),
  });
  const payload = await request.json();
  if (!request.ok) throw new Error(`OpenAI ${request.status}: ${payload?.error?.message ?? "request failed"}`);
  return parsePuzzleResponsePayload(payload);
}

/** Same secrets and model settings as the daily generator; guided runs default to lower effort for speed. */
function readConfig() {
  const value = (name: string) => {
    const result = Deno.env.get(name);
    if (!result) throw new Error(`Missing required secret ${name}.`);
    return result;
  };
  const reasoningEffort = Deno.env.get("OPENAI_GUIDED_REASONING_EFFORT") ?? Deno.env.get("OPENAI_PUZZLE_REASONING_EFFORT") ?? "low";
  if (reasoningEffort !== "none" && reasoningEffort !== "low" && reasoningEffort !== "medium" && reasoningEffort !== "high") {
    throw new Error("OPENAI_GUIDED_REASONING_EFFORT must be none, low, medium, or high.");
  }
  const temperature = Number(Deno.env.get("OPENAI_PUZZLE_TEMPERATURE") ?? "0.4");
  const maxOutputTokens = Number(Deno.env.get("OPENAI_PUZZLE_MAX_OUTPUT_TOKENS") ?? "16000");
  const requestTimeoutMs = Number(Deno.env.get("OPENAI_REQUEST_TIMEOUT_MS") ?? "90000");
  return {
    supabaseUrl: value("SUPABASE_URL"),
    serviceRoleKey: value("SUPABASE_SERVICE_ROLE_KEY"),
    openAiKey: value("OPENAI_API_KEY"),
    model: Deno.env.get("OPENAI_PUZZLE_MODEL") ?? "gpt-5.4-mini",
    reasoningEffort: reasoningEffort as "none" | "low" | "medium" | "high",
    temperature: Number.isFinite(temperature) ? temperature : 0.4,
    maxOutputTokens: Number.isInteger(maxOutputTokens) ? maxOutputTokens : 16_000,
    requestTimeoutMs: Number.isInteger(requestTimeoutMs) ? Math.min(Math.max(requestTimeoutMs, 15_000), 90_000) : 90_000,
  };
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
