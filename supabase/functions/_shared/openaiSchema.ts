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
const commitId = boundedString(openAIDraftLimits.commitId);
const branchName = boundedString(openAIDraftLimits.branchName);
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
    objectives: { type: "array", items: boundedString(openAIDraftLimits.objective) },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    initialRepository: {
      type: "object",
      additionalProperties: false,
      properties: {
        commits: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: commitId, parents: { type: "array", items: commitId },
              message: boundedString(openAIDraftLimits.commitMessage),
              changes: {
                type: "array",
                items: {
                  type: "object", additionalProperties: false,
                  properties: { type: { type: "string", enum: ["set"] }, property: { type: "string", enum: ["sunglasses", "hat", "scarf", "crest", "longLegs"] }, from: accessoryValue, to: accessoryValue },
                  required: ["type", "property", "from", "to"],
                },
              },
              provenance: {
                type: "object", additionalProperties: false,
                properties: { type: { type: "string", enum: ["original"] }, sourceCommits: { type: "array", items: commitId } },
                required: ["type", "sourceCommits"],
              },
            },
            required: ["id", "parents", "message", "changes", "provenance"],
          },
        },
        branches: {
          type: "array",
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
        branchHeads: { type: "array", items: { type: "object", additionalProperties: false, properties: { branch: branchName, commit: commitId }, required: ["branch", "commit"] } },
        requiredProvenance: { type: "array", items: { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["cherry-pick", "revert", "merge"] }, sourceCommit: commitId }, required: ["type", "sourceCommit"] } },
      },
      required: ["branch", "snapshot", "branchHeads", "requiredProvenance"],
    },
    allowedCommands: { type: "array", items: { type: "string", enum: ["log", "switch", "merge", "cherry-pick", "revert"] } },
    hints: { type: "array", items: boundedString(openAIDraftLimits.hint) },
    solutionCommands: { type: "array", items: boundedString(openAIDraftLimits.solutionCommand) },
  },
  required: ["title", "description", "objectives", "difficulty", "initialRepository", "target", "allowedCommands", "hints", "solutionCommands"],
} as const;

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
