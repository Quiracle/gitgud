const accessoryValue = { type: "string", enum: ["none", "black", "red", "blue", "turquoise", "purple", "gold"] } as const;
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
    title: { type: "string" },
    description: { type: "string" },
    objectives: { type: "array", items: { type: "string" } },
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
              id: { type: "string" }, parents: { type: "array", items: { type: "string" } },
              message: { type: "string" },
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
                properties: { type: { type: "string", enum: ["original"] }, sourceCommits: { type: "array", items: { type: "string" } } },
                required: ["type", "sourceCommits"],
              },
            },
            required: ["id", "parents", "message", "changes", "provenance"],
          },
        },
        branches: {
          type: "array",
          items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, head: { type: "string" } }, required: ["name", "head"] },
        },
        currentBranch: { type: "string" }, head: { type: "string" }, initialState: state,
        nextGeneratedId: { type: "integer" },
      },
      required: ["commits", "branches", "currentBranch", "head", "initialState", "nextGeneratedId"],
    },
    target: {
      type: "object", additionalProperties: false,
      properties: {
        branch: { type: "string" }, snapshot: state,
        branchHeads: { type: "array", items: { type: "object", additionalProperties: false, properties: { branch: { type: "string" }, commit: { type: "string" } }, required: ["branch", "commit"] } },
        requiredProvenance: { type: "array", items: { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["cherry-pick", "revert", "merge"] }, sourceCommit: { type: "string" } }, required: ["type", "sourceCommit"] } },
      },
      required: ["branch", "snapshot", "branchHeads", "requiredProvenance"],
    },
    allowedCommands: { type: "array", items: { type: "string", enum: ["log", "switch", "merge", "cherry-pick", "revert"] } },
    hints: { type: "array", items: { type: "string" } },
    solutionCommands: { type: "array", items: { type: "string" } },
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
