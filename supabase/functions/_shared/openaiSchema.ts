const accessoryValue = { type: "string", enum: ["none", "black", "red", "blue", "turquoise", "purple", "gold"] } as const;
export const openAIDraftLimits = {
  title: 120,
  description: 600,
  commitId: 48,
  branchName: 48,
  commitMessage: 240,
  hint: 240,
  objective: 240,
  solutionCommand: 160,
} as const;

const boundedString = (maxLength: number) => ({ type: "string", minLength: 1, maxLength } as const);
const commitId = {
  ...boundedString(openAIDraftLimits.commitId),
  pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
  description: "A short Git commit ID. Use only an ID allowed by this schema.",
} as const;
const branchName = {
  ...boundedString(openAIDraftLimits.branchName),
  pattern: "^[A-Za-z][A-Za-z0-9._/-]*$",
  description: "A Git branch name. Use only a branch name allowed by this schema.",
} as const;
const state = {
  type: "object",
  additionalProperties: false,
  properties: {
    sunglasses: accessoryValue, hat: accessoryValue, scarf: accessoryValue,
    crest: accessoryValue, longLegs: accessoryValue,
  },
  required: ["sunglasses", "hat", "scarf", "crest", "longLegs"],
} as const;

export const dailyPuzzleDraftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: boundedString(openAIDraftLimits.title),
    description: boundedString(openAIDraftLimits.description),
    objectives: { type: "array", minItems: 1, maxItems: 10, items: boundedString(openAIDraftLimits.objective) },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    initialRepository: {
      type: "object",
      additionalProperties: false,
      properties: {
        commits: {
          type: "array",
          minItems: 1,
          maxItems: 25,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: commitId, parents: { type: "array", maxItems: 2, items: commitId },
              message: boundedString(openAIDraftLimits.commitMessage),
              changes: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object", additionalProperties: false,
                  properties: { type: { type: "string", enum: ["set"] }, property: { type: "string", enum: ["sunglasses", "hat", "scarf", "crest", "longLegs"] }, from: accessoryValue, to: accessoryValue },
                  required: ["type", "property", "from", "to"],
                },
              },
              provenance: {
                type: "object", additionalProperties: false,
                properties: { type: { type: "string", enum: ["original"] }, sourceCommits: { type: "array", maxItems: 4, items: commitId } },
                required: ["type", "sourceCommits"],
              },
            },
            required: ["id", "parents", "message", "changes", "provenance"],
          },
        },
        branches: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "object", additionalProperties: false, properties: { name: branchName, head: commitId }, required: ["name", "head"] },
        },
        currentBranch: branchName, head: commitId, initialState: state,
        nextGeneratedId: { type: "integer" },
      },
      required: ["commits", "branches", "currentBranch", "head", "initialState", "nextGeneratedId"],
    },
    target: {
      type: "object", additionalProperties: false,
      properties: {
        branch: branchName, snapshot: state,
        branchHeads: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, properties: { branch: branchName, commit: commitId }, required: ["branch", "commit"] } },
        requiredProvenance: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["cherry-pick", "revert", "merge"] }, sourceCommit: commitId }, required: ["type", "sourceCommit"] } },
      },
      required: ["branch", "snapshot", "branchHeads", "requiredProvenance"],
    },
    allowedCommands: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", enum: ["log", "switch", "merge", "cherry-pick", "revert"] } },
    hints: { type: "array", maxItems: 6, items: boundedString(openAIDraftLimits.hint) },
    solutionCommands: { type: "array", minItems: 1, maxItems: 20, items: boundedString(openAIDraftLimits.solutionCommand) },
  },
  required: ["title", "description", "objectives", "difficulty", "initialRepository", "target", "allowedCommands", "hints", "solutionCommands"],
} as const;

/** Tighten the general safety schema to the exact persisted generation brief. */
export function createDailyPuzzleDraftSchema(brief: Record<string, any>) {
  const schema = structuredClone(dailyPuzzleDraftSchema) as any;
  const exact = (target: Record<string, unknown>, count: unknown) => {
    if (!Number.isInteger(count) || (count as number) < 0) throw new Error("Generation brief contains an invalid item count.");
    target.minItems = count;
    target.maxItems = count;
  };

  exact(schema.properties.initialRepository.properties.commits, brief.commitCount);
  exact(schema.properties.initialRepository.properties.branches, brief.branchCount);
  exact(schema.properties.hints, brief.hintCount);

  const commitIds = Array.from({ length: brief.commitCount }, (_, index) => `c${index + 1}`);
  const branchNames = ["main", "feature", "style", "polish"].slice(0, brief.branchCount);
  const commit = schema.properties.initialRepository.properties.commits.items.properties;
  const repository = schema.properties.initialRepository.properties;
  const target = schema.properties.target.properties;

  commit.id.enum = commitIds;
  commit.id.description = `Use every ID exactly once: ${commitIds.join(", ")}.`;
  commit.parents.items.enum = commitIds;
  commit.parents.items.description = "Reference an existing earlier-numbered commit, or use an empty parent array for the root.";
  commit.provenance.properties.sourceCommits.items.enum = commitIds;
  repository.branches.items.properties.name.enum = branchNames;
  repository.branches.items.properties.name.description = `Use every branch exactly once: ${branchNames.join(", ")}.`;
  repository.branches.items.properties.head.enum = commitIds;
  repository.currentBranch = {
    ...repository.currentBranch,
    enum: ["main"],
    description: "The simulation always starts on main.",
  };
  repository.head.enum = commitIds;
  target.branch = {
    ...target.branch,
    enum: ["main"],
    description: "The solved puzzle must finish on main.",
  };
  target.branchHeads.items.properties.branch.enum = branchNames;
  target.branchHeads.items.properties.commit.enum = commitIds;
  target.requiredProvenance.items.properties.sourceCommit.enum = commitIds;
  exact(target.branchHeads, 0);
  exact(target.requiredProvenance, 0);

  const solutionLength = brief.solutionLength;
  if (
    !solutionLength ||
    !Number.isInteger(solutionLength.min) ||
    !Number.isInteger(solutionLength.max) ||
    solutionLength.min < 1 ||
    solutionLength.max < solutionLength.min
  ) {
    throw new Error("Generation brief contains an invalid solution length.");
  }
  schema.properties.solutionCommands.minItems = solutionLength.min;
  schema.properties.solutionCommands.maxItems = solutionLength.max;
  return schema;
}

export function materializeCandidate(draft: Record<string, any>, date: string) {
  const repository = draft.initialRepository;
  return {
    schemaVersion: 2,
    themeId: "chicken-v1",
    id: `daily-${date}`,
    version: 1,
    kind: "daily",
    slug: `daily-${date}`,
    publishedOn: date,
    title: draft.title,
    description: draft.description,
    objectives: draft.objectives,
    difficulty: draft.difficulty,
    initialRepository: {
      ...repository,
      commits: Object.fromEntries(repository.commits.map((commit: any) => [commit.id, commit])),
      branches: Object.fromEntries(repository.branches.map((branch: any) => [branch.name, branch.head])),
    },
    target: {
      ...draft.target,
      branchHeads: Object.fromEntries(draft.target.branchHeads.map((item: any) => [item.branch, item.commit])),
    },
    allowedCommands: draft.allowedCommands,
    hints: draft.hints,
    solutionCommands: draft.solutionCommands,
  };
}
