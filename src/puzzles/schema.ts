import { SUPPORTED_ACTION_TYPES, type Commit, type CommitProvenance, type PuzzleTarget, type Repository } from "../engine";
import type {
  ActionRequirement,
  JsonValue,
  PuzzleCandidate,
  PublicPuzzleDefinition,
  PuzzleDifficulty,
  PuzzleKind,
  SupportedCommand,
  ValidationIssue,
} from "./types";

const kinds = new Set<PuzzleKind>(["daily", "lesson", "generated"]);
const difficulties = new Set<PuzzleDifficulty>(["easy", "medium", "hard"]);
const commands = new Set<SupportedCommand>(SUPPORTED_ACTION_TYPES);
const provenanceTypes = new Set<CommitProvenance["type"]>([
  "original",
  "cherry-pick",
  "revert",
  "merge",
  "rebase",
  "squash",
]);

type UnknownRecord = Record<string, unknown>;

export interface SchemaParseResult {
  candidate?: PuzzleCandidate;
  issues: ValidationIssue[];
}

export interface PublicSchemaParseResult {
  puzzle?: PublicPuzzleDefinition;
  issues: ValidationIssue[];
}

/** Parses a player-safe published definition without requiring private solution data. */
export function parsePublicPuzzleDefinition(input: unknown): PublicSchemaParseResult {
  if (!isPlainRecord(input)) {
    return { issues: [{ code: "schema.invalid-type", message: "Expected an object.", path: "$" }] };
  }
  if (Object.hasOwn(input, "solutionCommands")) {
    return {
      issues: [{
        code: "schema.private-data-exposed",
        message: "Published puzzle definitions must not contain solutionCommands.",
        path: "$.solutionCommands",
      }],
    };
  }
  const parsed = parsePuzzleCandidate({ ...input, solutionCommands: [] });
  if (!parsed.candidate) return { issues: parsed.issues };
  const { solutionCommands: _privateSolution, ...puzzle } = parsed.candidate;
  return { puzzle, issues: parsed.issues };
}

/** Strictly parses JSON-shaped data; semantic and graph policy checks happen afterwards. */
export function parsePuzzleCandidate(input: unknown): SchemaParseResult {
  const issues: ValidationIssue[] = [];
  const root = record(input, "$", issues);
  if (!root) return { issues };

  rejectUnknownKeys(
    root,
    [
      "schemaVersion", "id", "version", "kind", "slug", "title", "description",
      "difficulty", "objectives", "initialRepository", "target", "allowedCommands",
      "hints", "actionRequirements", "solutionCommands", "themeId", "publishedOn", "parCommands",
    ],
    "$",
    issues,
  );

  const schemaVersion = integer(root.schemaVersion, "$.schemaVersion", issues);
  const themeId = optionalString(root.themeId, "$.themeId", issues);
  const publishedOn = optionalString(root.publishedOn, "$.publishedOn", issues);
  const parCommands = root.parCommands === undefined ? undefined : integer(root.parCommands, "$.parCommands", issues);
  const id = string(root.id, "$.id", issues);
  const version = integer(root.version, "$.version", issues);
  const kind = enumValue(root.kind, kinds, "$.kind", issues);
  const slug = string(root.slug, "$.slug", issues);
  const title = string(root.title, "$.title", issues);
  const description = string(root.description, "$.description", issues);
  const difficulty = enumValue(root.difficulty, difficulties, "$.difficulty", issues);
  const objectives = stringArray(root.objectives, "$.objectives", issues, true);
  const repository = parseRepository(root.initialRepository, "$.initialRepository", issues);
  const target = parseTarget(root.target, "$.target", issues);
  const allowedCommands = enumArray(root.allowedCommands, commands, "$.allowedCommands", issues);
  const hints = stringArray(root.hints, "$.hints", issues, false);
  const actionRequirements = root.actionRequirements === undefined
    ? undefined
    : parseActionRequirements(root.actionRequirements, "$.actionRequirements", issues);
  const solutionCommands = stringArray(root.solutionCommands, "$.solutionCommands", issues, false);

  if (schemaVersion !== undefined && schemaVersion !== 1 && schemaVersion !== 2) {
    issue(issues, "schema.unsupported-version", "Only puzzle schema versions 1 and 2 are supported.", "$.schemaVersion");
  }
  if (schemaVersion === 2 && themeId !== "chicken-v1") {
    issue(issues, "schema.invalid-theme", "Puzzle schema version 2 requires themeId 'chicken-v1'.", "$.themeId");
  }
  if (publishedOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(publishedOn)) {
    issue(issues, "schema.invalid-date", "publishedOn must use YYYY-MM-DD UTC format.", "$.publishedOn");
  }

  if (
    issues.length > 0 || (schemaVersion !== 1 && schemaVersion !== 2) || id === undefined || version === undefined || kind === undefined || slug === undefined ||
    title === undefined || description === undefined || difficulty === undefined || repository === undefined || target === undefined || allowedCommands === undefined || hints === undefined ||
    solutionCommands === undefined || (root.actionRequirements !== undefined && actionRequirements === undefined)
  ) {
    return { issues };
  }

  return {
    issues,
    candidate: {
      schemaVersion,
      ...(themeId === "chicken-v1" ? { themeId } : {}),
      id,
      version,
      kind,
      slug,
      title,
      description,
      difficulty,
      ...(publishedOn ? { publishedOn } : {}),
      ...(parCommands !== undefined ? { parCommands } : {}),
      ...(objectives ? { objectives } : {}),
      initialRepository: repository,
      target,
      allowedCommands,
      hints,
      ...(actionRequirements ? { actionRequirements } : {}),
      solutionCommands,
    },
  };
}

function parseRepository(value: unknown, path: string, issues: ValidationIssue[]): Repository | undefined {
  const source = record(value, path, issues);
  if (!source) return undefined;
  rejectUnknownKeys(source, ["commits", "branches", "currentBranch", "head", "initialState", "nextGeneratedId"], path, issues);
  const commits = parseCommits(source.commits, `${path}.commits`, issues);
  const branches = stringRecord(source.branches, `${path}.branches`, issues);
  const currentBranch = string(source.currentBranch, `${path}.currentBranch`, issues);
  const head = string(source.head, `${path}.head`, issues);
  const initialState = jsonRecord(source.initialState, `${path}.initialState`, issues);
  const nextGeneratedId = integer(source.nextGeneratedId, `${path}.nextGeneratedId`, issues);
  if (commits === undefined || branches === undefined || currentBranch === undefined || head === undefined || initialState === undefined || nextGeneratedId === undefined) return undefined;
  return { commits, branches, currentBranch, head, initialState, nextGeneratedId };
}

function parseCommits(value: unknown, path: string, issues: ValidationIssue[]): Record<string, Commit> | undefined {
  const source = record(value, path, issues);
  if (!source) return undefined;
  const commits = Object.create(null) as Record<string, Commit>;
  for (const [id, rawCommit] of Object.entries(source)) {
    const commitPath = `${path}.${id}`;
    const raw = record(rawCommit, commitPath, issues);
    if (!raw) continue;
    rejectUnknownKeys(raw, ["id", "parents", "message", "changes", "provenance"], commitPath, issues);
    const declaredId = string(raw.id, `${commitPath}.id`, issues);
    const parents = stringArray(raw.parents, `${commitPath}.parents`, issues, false);
    const message = string(raw.message, `${commitPath}.message`, issues);
    const changes = parseChanges(raw.changes, `${commitPath}.changes`, issues);
    const provenance = parseProvenance(raw.provenance, `${commitPath}.provenance`, issues);
    if (declaredId === undefined || parents === undefined || message === undefined || changes === undefined) continue;
    commits[id] = { id: declaredId, parents, message, changes, ...(provenance ? { provenance } : {}) };
  }
  return commits;
}

function parseChanges(value: unknown, path: string, issues: ValidationIssue[]) {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array.", path);
    return undefined;
  }
  return value.flatMap((raw, index) => {
    const changePath = `${path}[${index}]`;
    const source = record(raw, changePath, issues);
    if (!source) return [];
    rejectUnknownKeys(source, ["type", "property", "from", "to"], changePath, issues);
    const type = string(source.type, `${changePath}.type`, issues);
    const property = string(source.property, `${changePath}.property`, issues);
    const from = jsonValue(source.from, `${changePath}.from`, issues);
    const to = jsonValue(source.to, `${changePath}.to`, issues);
    if (type === undefined || property === undefined || from === undefined || to === undefined) return [];
    // The semantic policy later rejects every operation other than `set`.
    return [{ type, property, from, to } as unknown as Commit["changes"][number]];
  });
}

function parseTarget(value: unknown, path: string, issues: ValidationIssue[]): PuzzleTarget | undefined {
  const source = record(value, path, issues);
  if (!source) return undefined;
  rejectUnknownKeys(source, ["branch", "snapshot", "branchHeads", "requiredProvenance"], path, issues);
  const branch = string(source.branch, `${path}.branch`, issues);
  const snapshot = jsonRecord(source.snapshot, `${path}.snapshot`, issues);
  const branchHeads = source.branchHeads === undefined ? undefined : stringRecord(source.branchHeads, `${path}.branchHeads`, issues);
  const requiredProvenance = source.requiredProvenance === undefined ? undefined : parseRequiredProvenance(source.requiredProvenance, `${path}.requiredProvenance`, issues);
  if (branch === undefined || snapshot === undefined || (source.branchHeads !== undefined && branchHeads === undefined) || (source.requiredProvenance !== undefined && requiredProvenance === undefined)) return undefined;
  return { branch, snapshot, ...(branchHeads ? { branchHeads } : {}), ...(requiredProvenance ? { requiredProvenance } : {}) };
}

function parseActionRequirements(value: unknown, path: string, issues: ValidationIssue[]): ActionRequirement[] | undefined {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array of action requirements.", path);
    return undefined;
  }

  const requirements: ActionRequirement[] = [];
  value.forEach((raw, index) => {
    const itemPath = `${path}[${index}]`;
    const source = record(raw, itemPath, issues);
    if (!source) return;
    const type = enumValue(source.type, commands, `${itemPath}.type`, issues);
    if (!type) return;

    switch (type) {
      case "log": {
        rejectUnknownKeys(source, ["type", "all"], itemPath, issues);
        const all = boolean(source.all, `${itemPath}.all`, issues);
        if (all !== undefined) requirements.push({ type, all });
        return;
      }
      case "merge": {
        rejectUnknownKeys(source, ["type", "ffOnly"], itemPath, issues);
        const ffOnly = boolean(source.ffOnly, `${itemPath}.ffOnly`, issues);
        if (ffOnly !== undefined) requirements.push({ type, ffOnly });
        return;
      }
      case "switch": {
        rejectUnknownKeys(source, ["type", "branch"], itemPath, issues);
        const branch = optionalString(source.branch, `${itemPath}.branch`, issues);
        if (branch !== undefined || source.branch === undefined) {
          requirements.push({ type, ...(branch === undefined ? {} : { branch }) });
        }
        return;
      }
      case "cherry-pick": {
        rejectUnknownKeys(source, ["type", "commit"], itemPath, issues);
        const commit = optionalString(source.commit, `${itemPath}.commit`, issues);
        if (commit !== undefined || source.commit === undefined) {
          requirements.push({ type, ...(commit === undefined ? {} : { commit }) });
        }
        return;
      }
      case "revert": {
        rejectUnknownKeys(source, ["type", "commit"], itemPath, issues);
        const commit = optionalString(source.commit, `${itemPath}.commit`, issues);
        if (commit !== undefined || source.commit === undefined) {
          requirements.push({ type, ...(commit === undefined ? {} : { commit }) });
        }
        return;
      }
      case "rebase":
      case "interactive-rebase": {
        rejectUnknownKeys(source, ["type", "onto"], itemPath, issues);
        const onto = optionalString(source.onto, `${itemPath}.onto`, issues);
        if (onto !== undefined || source.onto === undefined) {
          requirements.push({ type, ...(onto === undefined ? {} : { onto }) });
        }
        return;
      }
    }
  });
  return requirements;
}

function parseRequiredProvenance(value: unknown, path: string, issues: ValidationIssue[]) {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array.", path);
    return undefined;
  }
  return value.flatMap((raw, index) => {
    const itemPath = `${path}[${index}]`;
    const source = record(raw, itemPath, issues);
    if (!source) return [];
    rejectUnknownKeys(source, ["type", "sourceCommit"], itemPath, issues);
    const type = enumValue(source.type, provenanceTypes, `${itemPath}.type`, issues);
    const sourceCommit = string(source.sourceCommit, `${itemPath}.sourceCommit`, issues);
    return type !== undefined && sourceCommit !== undefined ? [{ type, sourceCommit }] : [];
  });
}

function parseProvenance(value: unknown, path: string, issues: ValidationIssue[]): CommitProvenance | undefined {
  if (value === undefined) return undefined;
  const source = record(value, path, issues);
  if (!source) return undefined;
  rejectUnknownKeys(source, ["type", "sourceCommits"], path, issues);
  const type = enumValue(source.type, provenanceTypes, `${path}.type`, issues);
  const sourceCommits = source.sourceCommits === undefined ? undefined : stringArray(source.sourceCommits, `${path}.sourceCommits`, issues, false);
  if (type === undefined || (source.sourceCommits !== undefined && sourceCommits === undefined)) return undefined;
  return { type, ...(sourceCommits ? { sourceCommits } : {}) };
}

function record(value: unknown, path: string, issues: ValidationIssue[]): UnknownRecord | undefined {
  if (!isPlainRecord(value)) {
    issue(issues, "schema.invalid-type", "Expected an object.", path);
    return undefined;
  }
  return value;
}

function stringRecord(value: unknown, path: string, issues: ValidationIssue[]): Record<string, string> | undefined {
  const source = record(value, path, issues);
  if (!source) return undefined;
  const result = Object.create(null) as Record<string, string>;
  for (const [key, item] of Object.entries(source)) {
    const parsed = string(item, `${path}.${key}`, issues);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}

function jsonRecord(value: unknown, path: string, issues: ValidationIssue[]): Record<string, JsonValue> | undefined {
  const source = record(value, path, issues);
  if (!source) return undefined;
  const result = Object.create(null) as Record<string, JsonValue>;
  for (const [key, item] of Object.entries(source)) {
    const parsed = jsonValue(item, `${path}.${key}`, issues);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}

function jsonValue(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  ancestors = new Set<object>(),
  remainingDepth = 64,
): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    issue(issues, "semantic.non-json-value", "Semantic values must be finite JSON values.", path);
    return undefined;
  }
  if (remainingDepth <= 0 || typeof value !== "object" || ancestors.has(value)) {
    issue(issues, "semantic.non-json-value", "Semantic values must be JSON-serializable.", path);
    return undefined;
  }
  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    value.forEach((item, index) => {
      const parsed = jsonValue(item, `${path}[${index}]`, issues, nextAncestors, remainingDepth - 1);
      if (parsed !== undefined) result.push(parsed);
    });
    return result;
  }
  if (!isPlainRecord(value)) {
    issue(issues, "semantic.non-json-value", "Semantic values must be plain JSON objects.", path);
    return undefined;
  }
  const result = Object.create(null) as Record<string, JsonValue>;
  Object.entries(value).forEach(([key, item]) => {
    const parsed = jsonValue(item, `${path}.${key}`, issues, nextAncestors, remainingDepth - 1);
    if (parsed !== undefined) result[key] = parsed;
  });
  return result;
}

function string(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  if (typeof value !== "string") {
    issue(issues, "schema.invalid-type", "Expected a string.", path);
    return undefined;
  }
  return value;
}

function optionalString(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  return value === undefined ? undefined : string(value, path, issues);
}

function boolean(value: unknown, path: string, issues: ValidationIssue[]): boolean | undefined {
  if (typeof value !== "boolean") {
    issue(issues, "schema.invalid-type", "Expected a boolean.", path);
    return undefined;
  }
  return value;
}

function integer(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issue(issues, "schema.invalid-type", "Expected an integer.", path);
    return undefined;
  }
  return value;
}

function stringArray(value: unknown, path: string, issues: ValidationIssue[], optional: boolean): string[] | undefined {
  if (value === undefined && optional) return undefined;
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array of strings.", path);
    return undefined;
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    const parsed = string(item, `${path}[${index}]`, issues);
    if (parsed !== undefined) result.push(parsed);
  });
  return result;
}

function enumArray<T extends string>(value: unknown, values: Set<T>, path: string, issues: ValidationIssue[]): T[] | undefined {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array.", path);
    return undefined;
  }
  const result: T[] = [];
  value.forEach((item, index) => {
    const parsed = enumValue(item, values, `${path}[${index}]`, issues);
    if (parsed) result.push(parsed);
  });
  return result;
}

function enumValue<T extends string>(value: unknown, values: Set<T>, path: string, issues: ValidationIssue[]): T | undefined {
  if (typeof value === "string" && values.has(value as T)) return value as T;
  issue(issues, "schema.invalid-enum", `Expected one of: ${[...values].join(", ")}.`, path);
  return undefined;
}

function rejectUnknownKeys(source: UnknownRecord, allowed: string[], path: string, issues: ValidationIssue[]) {
  Object.keys(source).filter((key) => !allowed.includes(key)).forEach((key) => {
    issue(issues, "schema.unknown-property", "This property is not part of puzzle schema v1.", `${path}.${key}`);
  });
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function issue(issues: ValidationIssue[], code: string, message: string, path: string) {
  issues.push({ code, message, path });
}
