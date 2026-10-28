import { createClient } from "npm:@supabase/supabase-js@2.76.1";
import { publishProceduralDaily, verifyCandidateArtifact, PROCEDURAL_CERTIFICATION } from "../_shared/domain.bundle.js";
import { createProceduralDailyStore } from "../_shared/proceduralDailyStore.ts";
import { createStoryRequestBody } from "../_shared/storyRequest.ts";
import { parsePuzzleResponsePayload } from "../_shared/openaiRequest.ts";

type Difficulty = "easy" | "medium" | "hard";
const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const certification = PROCEDURAL_CERTIFICATION.sourceFingerprint;

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  try {
    if (request.headers.get("x-generation-secret") !== required("DAILY_GENERATION_SECRET")) {
      return response({ error: "Unauthorized." }, 401);
    }
    const raw = await request.text();
    if (raw.length > 1_000_000) return response({ error: "Request is too large." }, 413);
    let body: any;
    try { body = JSON.parse(raw); } catch { body = null; }
    if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "Expected a JSON object." }, 400);
    const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (body.mode === "preflight") {
      const inventory = await reserveInventory(db);
      return response({ ready: difficulties.every(d => inventory.counts[d] >= 14) && ["medium", "hard"].every(d => {
          const difficulty = d as Difficulty;
          return inventory.patterns[difficulty] >= 4 && Math.max(0, ...Object.values(inventory.strategies[difficulty])) <= inventory.counts[difficulty] * 0.35;
        }),
        generationMethod: "procedural-v1", certification,
        storyAvailable: Boolean(Deno.env.get("OPENAI_API_KEY")), reserveCounts: inventory.counts, patternCounts: inventory.patterns, strategyCounts: inventory.strategies });
    }
    if (body.mode === "register-candidates") {
      if (!Array.isArray(body.artifacts) || body.artifacts.length < 1 || body.artifacts.length > 20) return response({ error: "Supply 1 to 20 certified candidate artifacts." }, 400);
      const artifacts = [];
      for (const artifact of body.artifacts) artifacts.push(await verifyCandidateArtifact(artifact, { sourceFingerprint: certification }));
      const registered = await db.rpc("register_procedural_candidates", { target_artifacts: artifacts });
      if (registered.error) throw registered.error;
      return response({ ...registered.data, certification });
    }
    if (body.mode === "inventory") {
      if (body.after !== undefined && !/^[a-f0-9]{64}$/.test(body.after)) return response({ error: "Invalid inventory cursor." }, 400);
      let query = db.from("daily_certified_candidates").select("id,mechanics_hash,decision_core_hash").order("id").limit(500);
      if (body.after) query = query.gt("id", body.after);
      const result = await query;
      if (result.error) throw result.error;
      const entries = result.data ?? [];
      return response({ entries, next: entries.length === 500 ? entries.at(-1).id : null, certification });
    }
    if (body.mode === "published-history") {
      if (body.after !== undefined && (typeof body.after !== "string" || body.after.length > 200)) return response({ error: "Invalid history cursor." }, 400);
      // Private worker only: include every version, not just the current archive
      // selection. Proofs never cross the public daily API boundary.
      let query = db.from("daily_puzzles").select("id,definition,proof:daily_puzzle_private(solution_commands)").order("id").limit(50);
      if (body.after) query = query.gt("id", body.after);
      const result = await query;
      if (result.error) throw result.error;
      const entries = (result.data ?? []).map((row: any) => ({ id: row.id, definition: row.definition, solution_commands: row.proof?.solution_commands }));
      return response({ entries, next: entries.length === 50 ? entries.at(-1).id : null, certification });
    }
    if (body.mode !== undefined && body.mode !== "generate") return response({ error: "Unknown mode." }, 400);
    const date = body.date ?? tomorrowDailyDate();
    if (!validDate(date)) return response({ error: "date must be a valid YYYY-MM-DD date." }, 400);
    const key = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_PUZZLE_MODEL") ?? "gpt-5.4-mini";
    const result = await publishProceduralDaily(date, {
      store: createProceduralDailyStore(db, key ? model : undefined), sourceFingerprint: certification,
      chooseDifficulty: randomDifficulty,
      ...(key ? { story: (context: { theme: string; target: Record<string, unknown> }) => requestStory(key, model, context) } : {}),
    });
    return response(result, result.status === "awaiting-candidate" ? 503 : 200);
  } catch (error) {
    console.error((error instanceof Error ? error.message : String(error)).slice(0, 500));
    return response({ error: "Daily publication could not complete." }, 503);
  }
});

async function requestStory(key: string, model: string, context: { theme: string; target: Record<string, unknown> }) {
  const request = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify(createStoryRequestBody({ model, reasoningEffort: "low", temperature: 0.7, maxOutputTokens: 4096 }, context)),
  });
  if (!request.ok) throw new Error("Story service unavailable.");
  return parsePuzzleResponsePayload(await request.json());
}

async function reserveInventory(db: any) {
  const counts = { easy: 0, medium: 0, hard: 0 };
  const patterns = { easy: new Set<string>(), medium: new Set<string>(), hard: new Set<string>() };
  const strategies: Record<Difficulty, Record<string, number>> = { easy: {}, medium: {}, hard: {} };
  const result = await db.from("daily_certified_candidates").select("difficulty,command_pattern")
    .eq("source_fingerprint", certification).is("consumed_on", null).is("withdrawn_at", null).limit(1000);
  if (result.error) throw result.error;
  for (const row of result.data ?? []) {
    if (!difficulties.includes(row.difficulty)) continue;
    const difficulty = row.difficulty as Difficulty;
    counts[difficulty]++;
    const key = row.command_pattern.split(" → ").sort().join("|");
    patterns[difficulty].add(key);
    strategies[difficulty][key] = (strategies[difficulty][key] ?? 0) + 1;
  }
  return { counts, strategies, patterns: { easy: patterns.easy.size, medium: patterns.medium.size, hard: patterns.hard.size } };
}

function randomDifficulty(): Difficulty {
  const values = new Uint32Array(1);
  // 2^32 is not divisible by 3; reject its one excess outcome.
  do { crypto.getRandomValues(values); } while (values[0] === 0xffffffff);
  return difficulties[values[0] % 3];
}
function validDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
function tomorrowDailyDate() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret ${name}.`);
  return value;
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
