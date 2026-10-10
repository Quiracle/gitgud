import { describe, expect, it } from "vitest";
import {
  createPreflightRequestBody,
  createPuzzleRequestBody,
  parsePuzzleResponsePayload,
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

  it("constrains generated arrays to the persisted brief", () => {
    const brief = {
      commitCount: 8,
      branchCount: 3,
      hintCount: 2,
      solutionLength: { min: 3, max: 7 },
    };
    const schema = createPuzzleRequestBody(config, "prompt", brief).text.format.schema;

    expect(schema.properties.initialRepository.properties.commits).toMatchObject({ minItems: 8, maxItems: 8 });
    expect(schema.properties.initialRepository.properties.branches).toMatchObject({ minItems: 3, maxItems: 3 });
    expect(schema.properties.hints).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(schema.properties.solutionCommands).toMatchObject({ minItems: 3, maxItems: 7 });
    expect(schema.properties.initialRepository.properties.commits.items.properties.changes.maxItems).toBe(5);
    expect(schema.properties.initialRepository.properties.commits.items.properties.id.enum)
      .toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
    expect(schema.properties.initialRepository.properties.branches.items.properties.name.enum)
      .toEqual(["main", "feature", "style"]);
    expect(schema.properties.initialRepository.properties.currentBranch.enum).toEqual(["main"]);
    expect(schema.properties.target.properties.branchHeads).toMatchObject({ minItems: 0, maxItems: 0 });
    expect(schema.properties.target.properties.requiredProvenance).toMatchObject({ minItems: 0, maxItems: 0 });
  });

  it("reports incomplete responses before attempting to parse their partial JSON", () => {
    expect(() => parsePuzzleResponsePayload({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [{ content: [{ type: "output_text", text: '{"partial":' }] }],
    })).toThrow("incomplete structured response (max_output_tokens)");
  });

  it("parses completed structured responses", () => {
    expect(parsePuzzleResponsePayload({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }],
    })).toEqual({ ok: true });
  });
});
