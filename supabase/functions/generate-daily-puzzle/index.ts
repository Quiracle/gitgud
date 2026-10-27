import { createClient } from "npm:@supabase/supabase-js@2.76.1";
import { publishDeterministicDaily, createCertifiedDaily, DAILY_CERTIFICATION } from "../_shared/domain.bundle.js";
import { createDailyStore } from "../_shared/dailyStore.ts";
import { createStoryRequestBody } from "../_shared/storyRequest.ts";
import { parsePuzzleResponsePayload } from "../_shared/openaiRequest.ts";

type Difficulty = "easy" | "medium" | "hard";
const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const certification = DAILY_CERTIFICATION.sourceFingerprint;
const templates = DAILY_CERTIFICATION.templates as Array<{ templateId: string; difficulty: Difficulty }>;

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  try {
    if (request.headers.get("x-generation-secret") !== required("DAILY_GENERATION_SECRET")) {
      return response({ error: "Unauthorized." }, 401);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "Expected a JSON object." }, 400);
    const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (body.mode === "preflight") {
      return response({ ready: difficulties.every(d => templates.some(t => t.difficulty === d)),
        generationMethod: "deterministic-v1", certification,
        storyAvailable: Boolean(Deno.env.get("OPENAI_API_KEY")), reserveCounts: await reserveCounts(db) });
    }
    if (body.mode === "prepare-reserve" || body.mode === "seed-fallbacks") {
      const desired = body.perDifficulty ?? 14;
      if (!Number.isInteger(desired) || desired < 2 || desired > 30 ||
          (body.difficulty !== undefined && !difficulties.includes(body.difficulty))) {
        return response({ error: "Choose 2–30 reserves per difficulty and a supported difficulty." }, 400);
      }
      const generated = await prepareReserve(db, desired, body.difficulty);
      const counts = await reserveCounts(db);
      return response({ ready: (body.difficulty ? [body.difficulty] : difficulties).every((d: Difficulty) => counts[d] >= desired), generated, counts });
    }
    if (body.mode !== undefined && body.mode !== "generate") return response({ error: "Unknown mode." }, 400);
    const date = body.date ?? tomorrowDailyDate();
    if (!validDate(date)) return response({ error: "date must be a valid YYYY-MM-DD date." }, 400);
    const key = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_PUZZLE_MODEL") ?? "gpt-5.4-mini";
    const result = await publishDeterministicDaily(date, {
      store: createDailyStore(db, certification, key ? model : undefined),
      chooseDifficulty: randomDifficulty, createSeed: () => crypto.randomUUID(),
      ...(key ? { story: (context: { theme: string; target: Record<string, unknown> }) => requestStory(key, model, context) } : {}),
    });
    return response(result);
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

async function reserveCounts(db: any): Promise<Record<Difficulty, number>> {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const difficulty of difficulties) {
    const result = await db.from("daily_mechanics_reserve").select("id", { count: "exact", head: true })
      .eq("difficulty", difficulty).eq("certification", certification).is("consumed_on", null);
    if (result.error) throw result.error;
    counts[difficulty] = result.count ?? 0;
  }
  return counts;
}

async function prepareReserve(db: any, desired: number, requested?: Difficulty) {
  const rows: Array<{ difficulty: Difficulty; seed: string; template_id: string; certification: string }> = [];
  for (const difficulty of requested ? [requested] : difficulties) {
    const existing = await db.from("daily_mechanics_reserve").select("template_id")
      .eq("difficulty", difficulty).eq("certification", certification).is("consumed_on", null);
    if (existing.error) throw existing.error;
    const counts = new Map(templates.filter(t => t.difficulty === difficulty).map(t => [t.templateId, 0]));
    for (const row of existing.data ?? []) if (counts.has(row.template_id)) counts.set(row.template_id, counts.get(row.template_id)! + 1);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    for (let i = total; i < desired; i += 1) {
      const templateId = [...counts.keys()].sort((a, b) => counts.get(a)! - counts.get(b)! || a.localeCompare(b))[0];
      const seed = crypto.randomUUID();
      createCertifiedDaily("2099-01-01", difficulty, seed, templateId);
      rows.push({ difficulty, seed, template_id: templateId, certification });
      counts.set(templateId, counts.get(templateId)! + 1);
    }
  }
  if (rows.length) {
    const inserted = await db.from("daily_mechanics_reserve").insert(rows);
    if (inserted.error) throw inserted.error;
  }
  return rows.length;
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
