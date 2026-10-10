import { dailyPuzzleDraftSchema } from "./openaiSchema.ts";

export interface OpenAIRequestConfig {
  model: string;
  temperature: number;
}

export function createPuzzleRequestBody(config: OpenAIRequestConfig, prompt: string) {
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
        schema: dailyPuzzleDraftSchema,
      },
    },
  };
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
