import { describe, expect, it } from "vitest";
import {
  createPreflightRequestBody,
  createPuzzleRequestBody,
} from "../../../supabase/functions/_shared/openaiRequest";

describe("OpenAI generation request contract", () => {
  const config = { model: "gpt-4.1-mini", temperature: 1.8 };

  it("uses the configured very high temperature without top_p", () => {
    const body = createPuzzleRequestBody(config, "prompt");
    expect(body.temperature).toBe(1.8);
    expect(body).not.toHaveProperty("top_p");
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.additionalProperties).toBe(false);
  });

  it("preflights the exact model and temperature configuration", () => {
    const body = createPreflightRequestBody(config);
    expect(body).toMatchObject({ model: "gpt-4.1-mini", temperature: 1.8 });
    expect(body).not.toHaveProperty("top_p");
  });
});
