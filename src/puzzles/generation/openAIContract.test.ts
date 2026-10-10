import { describe, expect, it } from "vitest";
import {
  createPreflightRequestBody,
  createPuzzleRequestBody,
} from "../../../supabase/functions/_shared/openaiRequest";
import { openAIDraftLimits } from "../../../supabase/functions/_shared/openaiSchema";
import { DEFAULT_PUZZLE_LIMITS } from "../policy";

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

  it("keeps generated string bounds aligned with candidate validation", () => {
    expect(openAIDraftLimits).toMatchObject({
      title: DEFAULT_PUZZLE_LIMITS.maxTitleLength,
      description: DEFAULT_PUZZLE_LIMITS.maxDescriptionLength,
      commitId: DEFAULT_PUZZLE_LIMITS.maxCommitIdLength,
      branchName: DEFAULT_PUZZLE_LIMITS.maxBranchNameLength,
      commitMessage: DEFAULT_PUZZLE_LIMITS.maxCommitMessageLength,
      hint: DEFAULT_PUZZLE_LIMITS.maxHintLength,
      objective: DEFAULT_PUZZLE_LIMITS.maxObjectiveLength,
      solutionCommand: DEFAULT_PUZZLE_LIMITS.maxSolutionCommandLength,
    });

    const schema = createPuzzleRequestBody(config, "prompt").text.format.schema;
    expect(schema.properties.hints.items.maxLength).toBe(DEFAULT_PUZZLE_LIMITS.maxHintLength);
    expect(schema.properties.initialRepository.properties.commits.items.properties.message.maxLength)
      .toBe(DEFAULT_PUZZLE_LIMITS.maxCommitMessageLength);
  });
});
