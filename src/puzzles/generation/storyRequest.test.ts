import { describe, expect, it } from "vitest";
import { createStoryRequestBody, dailyStorySchema } from "../../../supabase/functions/_shared/storyRequest";

describe("daily story request contract", () => {
  const target = { hat: "blue", scarf: "gold" };
  const context = { theme: "moonlit garden party", target };

  it("requires exactly equivalent bounded title and description text for all locales", () => {
    expect(dailyStorySchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["en", "ca", "es"],
    });
    expect(Object.keys(dailyStorySchema.properties)).toEqual(["en", "ca", "es"]);
    for (const locale of Object.values(dailyStorySchema.properties)) {
      expect(locale).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
          description: { type: "string", minLength: 1, maxLength: 600 },
        },
      });
      expect(Object.keys(locale.properties)).toEqual(["title", "description"]);
    }
  });

  it("sends only theme and target context, with no mechanics or proof fields", () => {
    const body = createStoryRequestBody({ model: "gpt-4.1-mini", temperature: 0.4 }, context);
    const userMessage = body.input.find((item) => item.role === "user")!;
    expect(JSON.parse(userMessage.content)).toEqual({ theme: context.theme, target });
    expect(userMessage.content).not.toMatch(/solution|proof|graph|branch|commit/i);
    expect(body).not.toHaveProperty("top_p");
    expect(body.max_output_tokens).toBe(4_096);
    expect(body.text.format.strict).toBe(true);
  });

  it("caps configured output and keeps legacy model sampling controls", () => {
    const body = createStoryRequestBody({ model: "gpt-4.1-mini", temperature: 0.2, maxOutputTokens: 20_000 }, context);
    expect(body.temperature).toBe(0.2);
    expect(body.max_output_tokens).toBe(4_096);
  });

  it("uses reasoning controls without temperature for supported GPT-5 models", () => {
    const body = createStoryRequestBody({
      model: "gpt-5.4-mini", temperature: 0.4, reasoningEffort: "medium", maxOutputTokens: 2_048,
    }, context);
    expect(body.reasoning).toEqual({ effort: "medium" });
    expect(body).not.toHaveProperty("temperature");
    expect(body.max_output_tokens).toBe(2_048);
  });
});
