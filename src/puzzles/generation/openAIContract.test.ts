import { describe, expect, it } from "vitest";
import {
  createPreflightRequestBody,
  createPuzzleRequestBody,
  parsePuzzleResponsePayload,
} from "../../../supabase/functions/_shared/openaiRequest";
import { openAIDraftLimits } from "../../../supabase/functions/_shared/openaiSchema";
import { materializeCandidate } from "../../../supabase/functions/_shared/openaiSchema";
import { DEFAULT_PUZZLE_LIMITS } from "../policy";

describe("OpenAI generation request contract", () => {
  const config = { model: "gpt-4.1-mini", temperature: 0.4 };

  it("uses the configured low temperature without top_p", () => {
    const body = createPuzzleRequestBody(config, "prompt");
    expect(body.temperature).toBe(0.4);
    expect(body).not.toHaveProperty("top_p");
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.additionalProperties).toBe(false);
  });

  it("uses reasoning instead of incompatible sampling controls for a gpt-5 model", () => {
    const reasoningConfig = { model: "gpt-5.4-mini", temperature: 0.4, reasoningEffort: "medium" } as const;
    const body = createPuzzleRequestBody(reasoningConfig, "prompt");
    expect(body.reasoning).toEqual({ effort: "medium" });
    expect(body).not.toHaveProperty("temperature");
    expect(body.max_output_tokens).toBe(16_000);

    const preflight = createPreflightRequestBody(reasoningConfig);
    expect(preflight.reasoning).toEqual({ effort: "medium" });
    expect(preflight).not.toHaveProperty("temperature");
    expect(preflight.max_output_tokens).toBe(4_096);
  });

  it("preflights the exact model and temperature configuration", () => {
    const body = createPreflightRequestBody(config);
    expect(body).toMatchObject({ model: "gpt-4.1-mini", temperature: 0.4 });
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

    const schema: any = createPuzzleRequestBody(config, "prompt").text.format.schema;
    expect(schema.properties.hints.items.maxLength).toBe(DEFAULT_PUZZLE_LIMITS.maxHintLength);
  });

  it("constrains generated arrays to the persisted brief", () => {
    const brief = {
      commitCount: 8,
      branchCount: 3,
      hintCount: 2,
      solutionLength: { min: 3, max: 7 },
    };
    const schema: any = createPuzzleRequestBody(config, "prompt", brief).text.format.schema;

    expect(schema.properties.initialRepository.properties.commits.required)
      .toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
    expect(schema.properties.initialRepository.properties.branches.required)
      .toEqual(["main", "feature", "style"]);
    expect(schema.properties.hints).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(schema.properties.solutionOperations).toMatchObject({ minItems: 3, maxItems: 7 });
    expect(schema.properties.initialRepository.properties.commits.properties.c1.properties.message.maxLength)
      .toBe(DEFAULT_PUZZLE_LIMITS.maxCommitMessageLength);
    expect(schema.properties.initialRepository.properties.commits.properties.c1.properties.parents)
      .toMatchObject({ minItems: 0, maxItems: 0 });
    expect(schema.properties.initialRepository.properties.commits.properties.c1.properties.parents.items)
      .not.toHaveProperty("enum");
    expect(schema.properties.initialRepository.properties.commits.properties.c8.properties.parents.items.enum)
      .toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
    expect(schema.properties.solutionOperations.items.properties.commit.enum)
      .toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
    expect(schema).not.toHaveProperty("properties.difficulty");
    expect(schema).not.toHaveProperty("properties.target");
  });

  it("materializes brief-owned fields and trusted structured commands", () => {
    const draft = {
      title: "Case", description: "A detective case for the chicken.", objectives: ["Solve it."], hints: ["Look."],
      initialRepository: {
        commits: {
          c1: { parents: [], message: "Start", changes: [] },
          c2: { parents: ["c1"], message: "Add scarf", changes: [{ type: "set", property: "scarf", from: "none", to: "red" }] },
        },
        branches: { main: "c1", feature: "c2" },
      },
      solutionOperations: [{ operation: "cherryPick", logAll: false, branch: "main", ffOnly: false, commit: "c2" }],
    };
    const brief = { difficulty: "easy", targetState: { sunglasses: "none", hat: "none", scarf: "red", crest: "none", longLegs: "none" }, allowedCommands: ["log", "switch", "cherry-pick"] };
    const candidate = materializeCandidate(draft, "2026-10-10", brief);
    expect(candidate).toMatchObject({ difficulty: "easy", allowedCommands: brief.allowedCommands, target: { branch: "main", snapshot: brief.targetState }, initialRepository: { currentBranch: "main", head: "c1" } });
    expect(candidate.solutionCommands).toEqual(["git cherry-pick c2"]);
    expect(candidate.initialRepository.commits.c2.provenance).toEqual({ type: "original", sourceCommits: [] });
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
