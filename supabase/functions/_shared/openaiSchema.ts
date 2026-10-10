/**
 * This is deliberately a draft schema, not the public puzzle schema. The model
 * supplies only editorial text and the variable commit graph. Everything that
 * is reserved in a GenerationBrief is attached by materializeCandidate.
 */
const accessoryValue = { type: "string", enum: ["none", "black", "red", "blue", "turquoise", "purple", "gold"] } as const;
export const openAIDraftLimits = {
  title: 120, description: 600, commitId: 48, branchName: 48,
  commitMessage: 240, hint: 240, objective: 240, solutionCommand: 160,
} as const;

const boundedString = (maxLength: number) => ({ type: "string", minLength: 1, maxLength } as const);
const change = {
  type: "object", additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["set"] },
    property: { type: "string", enum: ["sunglasses", "hat", "scarf", "crest", "longLegs"] },
    from: accessoryValue, to: accessoryValue,
  },
  required: ["type", "property", "from", "to"],
} as const;

const commitDraft = (parentIds: string[]) => ({
  type: "object", additionalProperties: false,
  properties: {
    parents: parentIds.length === 0
      ? { type: "array", minItems: 0, maxItems: 0, items: { type: "string" } }
      : { type: "array", maxItems: 2, items: { type: "string", enum: parentIds } },
    message: boundedString(openAIDraftLimits.commitMessage),
    changes: { type: "array", maxItems: 5, items: change },
  },
  required: ["parents", "message", "changes"],
});

const operationSchema = (commitIds: string[], branchNames: readonly string[]) => ({
  type: "object", additionalProperties: false,
  properties: {
    operation: { type: "string", enum: ["log", "switch", "merge", "cherryPick", "revert"] },
    logAll: { type: "boolean" },
    branch: { type: "string", enum: branchNames },
    ffOnly: { type: "boolean" },
    commit: { type: "string", enum: commitIds },
  },
  // Keeping all fields required avoids a broad free-form operation union in
  // Structured Outputs. Only the fields for the selected operation are used.
  required: ["operation", "logAll", "branch", "ffOnly", "commit"],
});

/** A loose schema used only by the provider preflight/unit tests. */
export const dailyPuzzleDraftSchema = {
  type: "object", additionalProperties: false,
  properties: {
    title: boundedString(openAIDraftLimits.title),
    description: boundedString(openAIDraftLimits.description),
    objectives: { type: "array", minItems: 1, maxItems: 10, items: boundedString(openAIDraftLimits.objective) },
    initialRepository: { type: "object", additionalProperties: false, properties: { commits: { type: "object" }, branches: { type: "object" } }, required: ["commits", "branches"] },
    hints: { type: "array", maxItems: 6, items: boundedString(openAIDraftLimits.hint) },
    solutionOperations: { type: "array", minItems: 1, maxItems: 20, items: { type: "object" } },
  },
  required: ["title", "description", "objectives", "initialRepository", "hints", "solutionOperations"],
} as const;

const BRANCH_NAMES = ["main", "feature", "style", "polish"] as const;

/** Tighten the provider contract to the immutable brief before every request. */
export function createDailyPuzzleDraftSchema(brief: Record<string, any>) {
  const { commitCount, branchCount, hintCount } = brief;
  if (!Number.isInteger(commitCount) || commitCount < 1 || !Number.isInteger(branchCount) || branchCount < 1 || branchCount > BRANCH_NAMES.length || !Number.isInteger(hintCount) || hintCount < 0) {
    throw new Error("Generation brief contains invalid graph counts.");
  }
  const solutionLength = brief.solutionLength;
  if (!solutionLength || !Number.isInteger(solutionLength.min) || !Number.isInteger(solutionLength.max) || solutionLength.min < 1 || solutionLength.max < solutionLength.min) {
    throw new Error("Generation brief contains an invalid solution length.");
  }

  const commitIds = Array.from({ length: commitCount }, (_, index) => `c${index + 1}`);
  const branchNames = BRANCH_NAMES.slice(0, branchCount);
  const commitProperties = Object.fromEntries(commitIds.map((id, index) => [id, commitDraft(commitIds.slice(0, index))]));
  const branchProperties = Object.fromEntries(branchNames.map((name) => [name, { type: "string", enum: commitIds }]));

  return {
    type: "object", additionalProperties: false,
    properties: {
      title: boundedString(openAIDraftLimits.title),
      description: boundedString(openAIDraftLimits.description),
      objectives: { type: "array", minItems: 1, maxItems: 10, items: boundedString(openAIDraftLimits.objective) },
      initialRepository: {
        type: "object", additionalProperties: false,
        properties: {
          commits: { type: "object", additionalProperties: false, properties: commitProperties, required: commitIds },
          branches: { type: "object", additionalProperties: false, properties: branchProperties, required: branchNames },
        },
        required: ["commits", "branches"],
      },
      hints: { type: "array", minItems: hintCount, maxItems: hintCount, items: boundedString(openAIDraftLimits.hint) },
      solutionOperations: { type: "array", minItems: solutionLength.min, maxItems: solutionLength.max, items: operationSchema(commitIds, branchNames) },
    },
    required: ["title", "description", "objectives", "initialRepository", "hints", "solutionOperations"],
  } as const;
}

function serializeOperation(operation: Record<string, any>) {
  switch (operation.operation) {
    case "log": return operation.logAll ? "git log --all" : "git log";
    case "switch": return `git switch ${operation.branch}`;
    case "merge": return operation.ffOnly ? `git merge --ff-only ${operation.branch}` : `git merge ${operation.branch}`;
    case "cherryPick": return `git cherry-pick ${operation.commit}`;
    case "revert": return `git revert ${operation.commit}`;
    default: throw new Error("Structured solution operation is not supported.");
  }
}

/** Attach every persisted invariant in trusted code, after the provider response. */
export function materializeCandidate(draft: Record<string, any>, date: string, brief: Record<string, any>) {
  const repository = draft.initialRepository;
  const commits = Object.fromEntries(Object.entries(repository.commits).map(([id, commit]: [string, any]) => [id, {
    ...commit, id, provenance: { type: "original", sourceCommits: [] },
  }]));
  const branches = repository.branches;
  return {
    schemaVersion: 2, themeId: "chicken-v1", id: `daily-${date}`, version: 1,
    kind: "daily", slug: `daily-${date}`, publishedOn: date,
    title: draft.title, description: draft.description, objectives: draft.objectives,
    difficulty: brief.difficulty,
    initialRepository: {
      commits, branches, currentBranch: "main", head: branches.main,
      initialState: { sunglasses: "none", hat: "none", scarf: "none", crest: "none", longLegs: "none" },
      nextGeneratedId: 1,
    },
    target: { branch: "main", snapshot: brief.targetState, branchHeads: {}, requiredProvenance: [] },
    allowedCommands: brief.allowedCommands,
    hints: draft.hints,
    solutionCommands: draft.solutionOperations.map(serializeOperation),
  };
}
