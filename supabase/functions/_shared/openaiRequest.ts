import { createDailyPuzzleDraftSchema, dailyPuzzleDraftSchema } from "./openaiSchema.ts";

export interface OpenAIRequestConfig {
  model: string;
  temperature: number;
}

export function createPuzzleRequestBody(
  config: OpenAIRequestConfig,
  prompt: string,
  brief?: Record<string, any>,
) {
  return {
    model: config.model,
    temperature: config.temperature,
    max_output_tokens: 8_000,
    input: [
      { role: "system", content: "You design safe, compact, solvable educational Git puzzles as structured data." },
      { role: "user", content: prompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "daily_chicken_puzzle",
        strict: true,
        schema: brief ? createDailyPuzzleDraftSchema(brief) : dailyPuzzleDraftSchema,
      },
    },
  };
}

export function parsePuzzleResponsePayload(payload: any) {
  if (payload?.status === "incomplete") {
    const reason = payload.incomplete_details?.reason ?? "unknown reason";
    throw new Error(`OpenAI returned an incomplete structured response (${reason}).`);
  }
  if (payload?.status && payload.status !== "completed") {
    throw new Error(`OpenAI response ended with status '${payload.status}'.`);
  }

  const content = payload?.output?.flatMap((item: any) => item.content ?? []) ?? [];
  const refusal = content.find((item: any) => item.type === "refusal")?.refusal;
  if (refusal) throw new Error(`OpenAI refused puzzle generation: ${refusal}`);

  const text = content.find((item: any) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no structured puzzle output.");
  try {
    return JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenAI returned malformed structured output: ${detail}`);
  }
}

export function createPreflightRequestBody(config: OpenAIRequestConfig) {
  return {
    model: config.model,
    temperature: config.temperature,
    max_output_tokens: 32,
    input: "Return an object confirming structured output is available.",
    text: {
      format: {
        type: "json_schema",
        name: "provider_preflight",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
      },
    },
  };
}
