// src/puzzles/chickenTheme.ts
var CHICKEN_ACCESSORY_SLOTS = [
  "sunglasses",
  "hat",
  "scarf",
  "crest",
  "longLegs"
];
var CHICKEN_COLORS = [
  "black",
  "red",
  "blue",
  "turquoise",
  "purple",
  "gold"
];
var CHICKEN_BODY_VALUES = ["none", "cream", ...CHICKEN_COLORS];
var EMPTY_CHICKEN_STATE = {
  sunglasses: "none",
  hat: "none",
  scarf: "none",
  crest: "none",
  longLegs: "none"
};
var allowedValues = ["none", ...CHICKEN_COLORS];
var CHICKEN_V2_SEMANTIC_POLICY = {
  properties: {
    ...Object.fromEntries(CHICKEN_ACCESSORY_SLOTS.map((slot) => [slot, allowedValues])),
    body: CHICKEN_BODY_VALUES
  },
  // `body` is optional: absent means the default cream chicken.
  requiredProperties: CHICKEN_ACCESSORY_SLOTS
};

// src/puzzles/generation/types.ts
var GENERATION_BRIEF_VERSION = 2;
var GENERATION_PROMPT_VERSION = 2;

// src/puzzles/generation/brief.ts
var STORY_THEMES = [
  "royal portrait",
  "beach holiday",
  "space mission",
  "detective case",
  "concert night",
  "winter expedition",
  "garden party",
  "sports day"
];
var ARCHETYPE_CONCEPT_OPTIONS = {
  "single-transfer": [["cherry-pick"]],
  "fast-forward": [["ff-only"]],
  "divergent-merge": [["switch", "merge"]],
  "curate-and-undo": [["cherry-pick", "revert"]],
  "multi-branch-curation": [["switch", "cherry-pick", "revert"]]
};
var GENERATION_PROFILES = {
  easy: {
    branches: [2, 2],
    commits: [3, 5],
    accessories: [1, 2],
    concepts: [1, 1],
    solution: [1, 3],
    hints: [2, 2],
    archetypes: ["single-transfer", "fast-forward"]
  },
  medium: {
    branches: [2, 3],
    commits: [5, 8],
    accessories: [2, 3],
    concepts: [2, 2],
    solution: [2, 5],
    hints: [1, 2],
    archetypes: ["divergent-merge", "curate-and-undo"]
  },
  hard: {
    branches: [3, 4],
    commits: [8, 14],
    accessories: [3, 5],
    concepts: [2, 3],
    solution: [3, 7],
    hints: [1, 1],
    archetypes: ["curate-and-undo", "multi-branch-curation"]
  }
};
function createGenerationBrief(date, difficulty, seed, overrides = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Daily puzzle date must use YYYY-MM-DD.");
  if (!seed.trim()) throw new Error("A non-empty generation seed is required.");
  const random = seededRandom(`${date}:${difficulty}:${seed}`);
  const profile = GENERATION_PROFILES[difficulty];
  const branchCount = integer(random, ...profile.branches);
  const commitCount = integer(random, ...profile.commits);
  const targetState = chooseTargetState(random, integer(random, ...profile.accessories));
  const randomArchetype = pick(random, profile.archetypes);
  const graphArchetype = overrides.graphArchetype ?? randomArchetype;
  const compatibleOptions = ARCHETYPE_CONCEPT_OPTIONS[graphArchetype].filter(
    (option) => option.length >= profile.concepts[0] && option.length <= profile.concepts[1]
  );
  const requiredConcepts = [...pick(random, compatibleOptions)];
  return {
    date,
    seed,
    briefVersion: GENERATION_BRIEF_VERSION,
    promptVersion: GENERATION_PROMPT_VERSION,
    difficulty,
    branchCount,
    commitCount,
    graphArchetype,
    targetState,
    requiredConcepts,
    allowedCommands: commandsFor(requiredConcepts),
    solutionLength: { min: profile.solution[0], max: profile.solution[1] },
    hintCount: overrides.hintCount ?? integer(random, ...profile.hints),
    storyTheme: pick(random, STORY_THEMES)
  };
}
function chooseTargetState(random, count) {
  const state = { ...EMPTY_CHICKEN_STATE };
  for (const slot of sample(random, CHICKEN_ACCESSORY_SLOTS, count)) {
    state[slot] = pick(random, CHICKEN_COLORS);
  }
  return state;
}
function commandsFor(concepts) {
  const commands2 = /* @__PURE__ */ new Set(["log", "switch"]);
  concepts.forEach((concept) => {
    if (concept === "ff-only" || concept === "merge") commands2.add("merge");
    else commands2.add(concept);
  });
  return [...commands2];
}
function integer(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}
function pick(random, values) {
  return values[Math.floor(random() * values.length)];
}
function sample(random, values, count) {
  const available = [...values];
  const result = [];
  while (result.length < count && available.length > 0) {
    result.push(available.splice(Math.floor(random() * available.length), 1)[0]);
  }
  return result;
}
function seededRandom(seed) {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = hash << 13 | hash >>> 19;
  }
  return () => {
    hash = Math.imul(hash ^ hash >>> 16, 2246822507);
    hash = Math.imul(hash ^ hash >>> 13, 3266489909);
    hash ^= hash >>> 16;
    let value = hash += 1831565813;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

// src/engine/errors.ts
var GitSimulationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "GitSimulationError";
  }
};

// src/engine/graph.ts
function getCommit(repository, commitId) {
  if (!Object.hasOwn(repository.commits, commitId)) {
    throw new GitSimulationError(`Unknown commit: ${commitId}`);
  }
  return repository.commits[commitId];
}
function getAncestorDistances(repository, startId) {
  getCommit(repository, startId);
  const distances = /* @__PURE__ */ new Map();
  const queue = [
    { id: startId, distance: 0 }
  ];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const knownDistance = distances.get(next.id);
    if (knownDistance !== void 0 && knownDistance <= next.distance) continue;
    distances.set(next.id, next.distance);
    for (const parent of getCommit(repository, next.id).parents) {
      queue.push({ id: parent, distance: next.distance + 1 });
    }
  }
  return distances;
}
function isAncestor(repository, ancestorId, descendantId) {
  return getAncestorDistances(repository, descendantId).has(ancestorId);
}
function findMergeBase(repository, leftId, rightId) {
  const left = getAncestorDistances(repository, leftId);
  const right = getAncestorDistances(repository, rightId);
  const common = [...left.keys()].filter((id) => right.has(id));
  if (common.length === 0) {
    throw new GitSimulationError("The branches do not share a common ancestor.");
  }
  common.sort((a, b) => {
    const distanceA = (left.get(a) ?? 0) + (right.get(a) ?? 0);
    const distanceB = (left.get(b) ?? 0) + (right.get(b) ?? 0);
    return distanceA - distanceB || a.localeCompare(b);
  });
  return common[0];
}
function getReachableCommits(repository, startId = repository.head) {
  return getReachableCommitsFrom(repository, [startId]);
}
function getReachableCommitsFrom(repository, startIds) {
  const commits = [];
  const visited = /* @__PURE__ */ new Set();
  const queue = [...startIds];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const commit = getCommit(repository, id);
    commits.push(commit);
    queue.push(...commit.parents);
  }
  return commits;
}
function branchesAtCommit(repository, commitId) {
  return Object.entries(repository.branches).filter(([, head]) => head === commitId).map(([branch]) => branch).sort();
}

// src/engine/values.ts
function semanticEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => semanticEqual(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every(
      (key, index) => key === rightKeys[index] && semanticEqual(left[key], right[key])
    );
  }
  return false;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/engine/snapshot.ts
function getSnapshot(repository, commitId = repository.head) {
  const memo = /* @__PURE__ */ new Map();
  const visiting = /* @__PURE__ */ new Set();
  const calculate = (id) => {
    const cached = memo.get(id);
    if (cached) return structuredClone(cached);
    if (visiting.has(id)) {
      throw new GitSimulationError("The commit graph contains a cycle.");
    }
    visiting.add(id);
    const commit = getCommit(repository, id);
    const parentState = commit.parents[0] ? calculate(commit.parents[0]) : structuredClone(repository.initialState);
    const snapshot = applyChangesUnchecked(parentState, commit.changes);
    visiting.delete(id);
    memo.set(id, snapshot);
    return structuredClone(snapshot);
  };
  return calculate(commitId);
}
function applyChanges(snapshot, changes) {
  const result = structuredClone(snapshot);
  for (const change of changes) {
    if (!semanticEqual(result[change.property], change.from)) {
      throw new GitSimulationError(
        `Merge conflict on \`${change.property}\`: this change expects ${formatValue(change.from)}, but here it is ${formatValue(result[change.property])}.

Conflict resolution is not supported in this version.`
      );
    }
    result[change.property] = structuredClone(change.to);
  }
  return result;
}
function diffSnapshots(from, to) {
  const properties = /* @__PURE__ */ new Set([...Object.keys(from), ...Object.keys(to)]);
  return [...properties].sort().filter((property) => !semanticEqual(from[property], to[property])).map((property) => ({
    type: "set",
    property,
    from: structuredClone(from[property]),
    to: structuredClone(to[property])
  }));
}
function applyChangesUnchecked(snapshot, changes) {
  const result = structuredClone(snapshot);
  for (const change of changes) {
    result[change.property] = structuredClone(change.to);
  }
  return result;
}
function formatValue(value) {
  return value === void 0 ? "undefined" : JSON.stringify(value);
}

// src/engine/clone.ts
function cloneRepository(repository) {
  return structuredClone(repository);
}

// src/engine/commands/shared.ts
function appendGeneratedCommit(source, message, parents, changes, provenance) {
  const repository = cloneRepository(source);
  let id = `g${repository.nextGeneratedId}`;
  while (Object.hasOwn(repository.commits, id)) {
    repository.nextGeneratedId += 1;
    id = `g${repository.nextGeneratedId}`;
  }
  repository.nextGeneratedId += 1;
  const commit = { id, parents, message, changes, provenance };
  repository.commits[id] = commit;
  repository.head = id;
  repository.branches[repository.currentBranch] = id;
  return { repository, commit };
}

// src/engine/commands/cherryPick.ts
function cherryPick(source, commitId) {
  const picked = getCommit(source, commitId);
  if (picked.parents.length > 1) {
    throw new GitSimulationError(
      "Cherry-picking merge commits is not supported in this version."
    );
  }
  applyChanges(getSnapshot(source), picked.changes);
  const { repository, commit } = appendGeneratedCommit(
    source,
    `Cherry-pick ${commitId}: ${picked.message}`,
    [source.head],
    structuredClone(picked.changes),
    { type: "cherry-pick", sourceCommits: [commitId] }
  );
  return {
    repository,
    output: [`[${source.currentBranch} ${commit.id}] ${commit.message}`],
    mutated: true
  };
}

// src/engine/commands/log.ts
function showLog(repository, all) {
  const otherBranchHeads = Object.entries(repository.branches).filter(([branch]) => branch !== repository.currentBranch).sort(([left], [right]) => left.localeCompare(right)).map(([, head]) => head);
  const startIds = all ? [repository.head, ...otherBranchHeads] : [repository.head];
  const output = getReachableCommitsFrom(repository, startIds).flatMap((commit) => {
    const branches = branchesAtCommit(repository, commit.id);
    const refs = branches.length > 0 ? ` (${branches.join(", ")})` : "";
    return [`commit ${commit.id}${refs}`, `    ${commit.message}`];
  });
  if (all) {
    output.unshift("Showing commits reachable from all branches:");
  }
  return { repository, output, mutated: false };
}

// src/engine/commands/merge.ts
function mergeBranch(source, branch, ffOnly) {
  if (!Object.hasOwn(source.branches, branch)) {
    throw new GitSimulationError(`Unknown branch: ${branch}`);
  }
  const targetHead = source.branches[branch];
  if (branch === source.currentBranch) {
    return { repository: source, output: ["Already up to date."], mutated: false };
  }
  if (isAncestor(source, targetHead, source.head)) {
    return { repository: source, output: ["Already up to date."], mutated: false };
  }
  if (isAncestor(source, source.head, targetHead)) {
    const repository2 = cloneRepository(source);
    const previousHead2 = repository2.head;
    repository2.head = targetHead;
    repository2.branches[repository2.currentBranch] = targetHead;
    return {
      repository: repository2,
      output: [`Updating ${previousHead2}..${targetHead}`, "Fast-forward"],
      mutated: true
    };
  }
  if (ffOnly) {
    throw new GitSimulationError(
      "Not possible to fast-forward. The branches have diverged."
    );
  }
  const baseId = findMergeBase(source, source.head, targetHead);
  const base = getSnapshot(source, baseId);
  const ours = getSnapshot(source, source.head);
  const theirs = getSnapshot(source, targetHead);
  const merged = mergeSnapshots(base, ours, theirs);
  const changes = diffSnapshots(ours, merged);
  const previousHead = source.head;
  const { repository, commit } = appendGeneratedCommit(
    source,
    `Merge branch '${branch}' into ${source.currentBranch}`,
    [previousHead, targetHead],
    changes,
    { type: "merge", sourceCommits: [targetHead] }
  );
  return {
    repository,
    output: [
      `Merge made by the simulated strategy.`,
      `[${source.currentBranch} ${commit.id}] ${commit.message}`
    ],
    mutated: true
  };
}
function mergeSnapshots(base, ours, theirs) {
  const merged = structuredClone(ours);
  const properties = /* @__PURE__ */ new Set([
    ...Object.keys(base),
    ...Object.keys(ours),
    ...Object.keys(theirs)
  ]);
  for (const property of properties) {
    const baseValue = base[property];
    const ourValue = ours[property];
    const theirValue = theirs[property];
    if (semanticEqual(ourValue, theirValue)) continue;
    if (semanticEqual(ourValue, baseValue)) {
      merged[property] = structuredClone(theirValue);
      continue;
    }
    if (semanticEqual(theirValue, baseValue)) continue;
    throw new GitSimulationError(
      `Merge conflict on \`${property}\`.

Conflict resolution is not supported in this version.`
    );
  }
  return merged;
}

// src/engine/commands/rebase.ts
function rebaseBranch(source, onto) {
  const upstreamHead = resolveUpstream(source, onto);
  if (isAncestor(source, upstreamHead, source.head)) {
    return {
      repository: source,
      output: [`Current branch ${source.currentBranch} is up to date.`],
      mutated: false
    };
  }
  if (isAncestor(source, source.head, upstreamHead)) {
    return fastForward(source, upstreamHead);
  }
  const commits = commitsToReplay(source, upstreamHead);
  return replay(source, upstreamHead, commits.map((commit) => [commit]));
}
function interactiveRebase(source, onto, todo) {
  const upstreamHead = resolveUpstream(source, onto);
  const commits = commitsToReplay(source, upstreamHead);
  if (commits.length === 0) {
    if (source.head !== upstreamHead && isAncestor(source, source.head, upstreamHead)) {
      return fastForward(source, upstreamHead);
    }
    return {
      repository: source,
      output: [`Current branch ${source.currentBranch} is up to date.`],
      mutated: false
    };
  }
  const plan = todo ?? commits.map((commit) => ({ action: "pick", commit: commit.id }));
  return replay(source, upstreamHead, groupTodo(commits, plan));
}
function resolveUpstream(repository, onto) {
  if (!Object.hasOwn(repository.branches, onto)) {
    throw new GitSimulationError(`Unknown branch: ${onto}`);
  }
  return repository.branches[onto];
}
function commitsToReplay(repository, upstreamHead) {
  const upstream = getAncestorDistances(repository, upstreamHead);
  const ordered = [];
  const visited = /* @__PURE__ */ new Set();
  const visit = (id) => {
    if (visited.has(id) || upstream.has(id)) return;
    visited.add(id);
    const commit = getCommit(repository, id);
    if (commit.parents.length === 0) {
      throw new GitSimulationError("The branches do not share a common ancestor.");
    }
    commit.parents.forEach(visit);
    if (commit.parents.length === 1) ordered.push(commit);
  };
  visit(repository.head);
  return ordered;
}
function groupTodo(commits, todo) {
  const expected = commits.map((commit) => commit.id);
  const listed = todo.map((item) => item.commit);
  if (!semanticEqual(expected, listed)) {
    throw new GitSimulationError(
      `The rebase todo list must keep these commits in order: ${expected.join(", ")}.
Reordering and dropping commits are not supported in this version.`
    );
  }
  if (todo[0]?.action !== "pick") {
    throw new GitSimulationError(
      "Cannot squash without a previous commit. The first todo entry must be pick."
    );
  }
  const groups = [];
  todo.forEach((item, index) => {
    if (item.action === "pick") groups.push([commits[index]]);
    else groups[groups.length - 1].push(commits[index]);
  });
  return groups;
}
function fastForward(source, upstreamHead) {
  const repository = cloneRepository(source);
  repository.head = upstreamHead;
  repository.branches[repository.currentBranch] = upstreamHead;
  return {
    repository,
    output: [
      `Fast-forwarded ${source.currentBranch} to ${upstreamHead}.`,
      successLine(source)
    ],
    mutated: true
  };
}
function replay(source, upstreamHead, groups) {
  let repository = cloneRepository(source);
  repository.head = upstreamHead;
  repository.branches[repository.currentBranch] = upstreamHead;
  const output = [];
  for (const group of groups) {
    const [first] = group;
    if (group.length === 1 && first.parents[0] === repository.head) {
      repository.head = first.id;
      repository.branches[repository.currentBranch] = first.id;
      continue;
    }
    const before = getSnapshot(repository);
    if (group.length === 1 && isAlreadyApplied(before, first.changes)) {
      output.push(`Dropped ${first.id}: its changes are already upstream.`);
      continue;
    }
    let after = before;
    for (const commit of group) after = applyOrConflict(after, commit);
    const squashed = group.length > 1;
    const changes = squashed ? diffSnapshots(before, after) : structuredClone(first.changes);
    const provenance = squashed ? { type: "squash", sourceCommits: group.map((commit) => commit.id) } : { type: "rebase", sourceCommits: [first.id] };
    const message = group.map((commit) => commit.message).join("; ");
    const appended = appendGeneratedCommit(
      repository,
      message,
      [repository.head],
      changes,
      provenance
    );
    repository = appended.repository;
    output.push(
      squashed ? `Squashed ${group.map((commit) => commit.id).join(", ")} into ${appended.commit.id}: ${message}` : `Replayed ${first.id} as ${appended.commit.id}: ${message}`
    );
  }
  if (repository.head === source.head) {
    return {
      repository: source,
      output: [`Current branch ${source.currentBranch} is up to date.`],
      mutated: false
    };
  }
  output.push(successLine(source));
  return { repository, output, mutated: true };
}
function applyOrConflict(state, commit) {
  const result = structuredClone(state);
  for (const change of commit.changes) {
    if (!semanticEqual(result[change.property], change.from)) {
      throw new GitSimulationError(
        `Merge conflict on \`${change.property}\` while replaying ${commit.id}.

Conflict resolution is not supported in this version.`
      );
    }
    result[change.property] = structuredClone(change.to);
  }
  return result;
}
function isAlreadyApplied(state, changes) {
  return changes.length > 0 && changes.every((change) => semanticEqual(state[change.property], change.to));
}
function successLine(source) {
  return `Successfully rebased and updated refs/heads/${source.currentBranch}.`;
}

// src/engine/commands/revert.ts
function revertCommit(source, commitId) {
  const reverted = getCommit(source, commitId);
  if (reverted.parents.length > 1) {
    throw new GitSimulationError(
      "Reverting merge commits is not supported in this version."
    );
  }
  const inverse = [...reverted.changes].reverse().map((change) => ({
    type: "set",
    property: change.property,
    from: structuredClone(change.to),
    to: structuredClone(change.from)
  }));
  applyChanges(getSnapshot(source), inverse);
  const { repository, commit } = appendGeneratedCommit(
    source,
    `Revert ${commitId}: ${reverted.message}`,
    [source.head],
    inverse,
    { type: "revert", sourceCommits: [commitId] }
  );
  return {
    repository,
    output: [`[${source.currentBranch} ${commit.id}] ${commit.message}`],
    mutated: true
  };
}

// src/engine/commands/switch.ts
function switchBranch(source, branch) {
  if (!Object.hasOwn(source.branches, branch)) {
    throw new GitSimulationError(`Unknown branch: ${branch}`);
  }
  const branchHead = source.branches[branch];
  if (source.currentBranch === branch) {
    return {
      repository: source,
      output: [`Already on '${branch}'.`],
      mutated: false
    };
  }
  const repository = cloneRepository(source);
  repository.currentBranch = branch;
  repository.head = branchHead;
  return {
    repository,
    output: [`Switched to branch '${branch}'.`],
    mutated: true
  };
}

// src/engine/parser.ts
var SUPPORTED_ACTION_TYPES = [
  "switch",
  "log",
  "merge",
  "cherry-pick",
  "revert",
  "rebase",
  "interactive-rebase"
];
var usage = {
  switch: "Usage: git switch <branch>",
  merge: "Usage: git merge [--ff-only] <branch>",
  cherryPick: "Usage: git cherry-pick <commit>",
  revert: "Usage: git revert <commit>",
  rebase: "Usage: git rebase <branch> or git rebase -i <branch>"
};
function parseGitCommand(input) {
  const [commandLine = "", ...todoLines] = input.trim().split(/\r?\n/);
  const tokens = commandLine.trim().split(/\s+/).filter(Boolean);
  const gitToken = tokens[0]?.toLowerCase();
  const command = tokens[1]?.toLowerCase();
  const todoSource = todoLines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
  if (todoSource.length > 0 && !(command === "rebase" && isInteractiveFlag(tokens[2]))) {
    return { ok: false, error: "Enter one Git command at a time." };
  }
  if (tokens.length === 0) {
    return { ok: false, error: "Type a Git command to continue." };
  }
  if (gitToken !== "git") {
    return {
      ok: false,
      error: "Only simulated Git commands are supported. Try `git log`."
    };
  }
  if (!command) {
    return {
      ok: false,
      error: "Choose a Git command, for example `git log` or `git switch main`."
    };
  }
  switch (command) {
    case "log":
      if (tokens.length === 2) {
        return { ok: true, action: { type: "log", all: false } };
      }
      if (tokens.length === 3 && tokens[2].toLowerCase() === "--all") {
        return { ok: true, action: { type: "log", all: true } };
      }
      return {
        ok: false,
        error: "This simulator supports `git log` and `git log --all`."
      };
    case "switch":
    case "checkout":
      if (tokens.length !== 3 || tokens[2].startsWith("-")) {
        return { ok: false, error: usage.switch };
      }
      return { ok: true, action: { type: "switch", branch: tokens[2] } };
    case "merge": {
      if (tokens.length === 3 && !tokens[2].startsWith("-")) {
        return {
          ok: true,
          action: { type: "merge", branch: tokens[2], ffOnly: false }
        };
      }
      if (tokens.length === 4 && tokens[2].toLowerCase() === "--ff-only" && !tokens[3].startsWith("-")) {
        return {
          ok: true,
          action: { type: "merge", branch: tokens[3], ffOnly: true }
        };
      }
      return { ok: false, error: usage.merge };
    }
    case "cherry-pick":
      if (tokens.length !== 3 || tokens[2].startsWith("-")) {
        return { ok: false, error: usage.cherryPick };
      }
      return { ok: true, action: { type: "cherry-pick", commit: tokens[2] } };
    case "revert":
      if (tokens.length !== 3 || tokens[2].startsWith("-")) {
        return { ok: false, error: usage.revert };
      }
      return { ok: true, action: { type: "revert", commit: tokens[2] } };
    case "rebase": {
      if (tokens.length === 3 && !tokens[2].startsWith("-")) {
        return { ok: true, action: { type: "rebase", onto: tokens[2] } };
      }
      if (tokens.length === 4 && isInteractiveFlag(tokens[2]) && !tokens[3].startsWith("-")) {
        if (todoSource.length === 0) {
          return { ok: true, action: { type: "interactive-rebase", onto: tokens[3] } };
        }
        const todo = parseRebaseTodo(todoSource);
        if (!todo.ok) return todo;
        return {
          ok: true,
          action: { type: "interactive-rebase", onto: tokens[3], todo: todo.todo }
        };
      }
      if (tokens[2]?.toLowerCase() === "--continue" || tokens[2]?.toLowerCase() === "--abort" || tokens[2]?.toLowerCase() === "--skip") {
        return {
          ok: false,
          error: "Rebases never stop for conflicts in this simulator, so there is nothing to continue or abort."
        };
      }
      return { ok: false, error: usage.rebase };
    }
    case "add":
    case "commit":
    case "push":
    case "pull":
    case "fetch":
    case "stash":
    case "reset":
    case "bisect":
    case "reflog":
    case "tag":
      return {
        ok: false,
        error: `\`git ${command}\` is not part of this puzzle simulator.`
      };
    default:
      return {
        ok: false,
        error: `Unknown Git command: ${command}. Try \`git log\` to inspect the repository.`
      };
  }
}
function isInteractiveFlag(token) {
  const normalized = token?.toLowerCase();
  return normalized === "-i" || normalized === "--interactive";
}
function parseRebaseTodo(lines) {
  const todo = [];
  for (const line of lines) {
    const [verb, commit] = line.split(/\s+/);
    const normalizedVerb = verb.toLowerCase();
    const action = normalizedVerb === "pick" || normalizedVerb === "p" ? "pick" : normalizedVerb === "squash" || normalizedVerb === "s" ? "squash" : void 0;
    if (!action) {
      return {
        ok: false,
        error: `Unsupported rebase todo command: ${verb}. Only pick and squash are available.`
      };
    }
    if (!commit) {
      return { ok: false, error: `Missing commit after \`${verb}\` in the rebase todo list.` };
    }
    todo.push({ action, commit });
  }
  return { ok: true, todo };
}

// src/engine/execute.ts
function executeCommand(repository, input) {
  const parsed = parseGitCommand(input);
  if (!parsed.ok) {
    return {
      ok: false,
      repository,
      output: [parsed.error],
      error: parsed.error
    };
  }
  try {
    const result = executeAction(repository, parsed.action);
    return { ok: true, action: parsed.action, ...result };
  } catch (error) {
    if (!(error instanceof GitSimulationError)) throw error;
    return {
      ok: false,
      repository,
      output: error.message.split("\n"),
      error: error.message
    };
  }
}
function executeAction(repository, action) {
  switch (action.type) {
    case "switch":
      return switchBranch(repository, action.branch);
    case "log":
      return showLog(repository, action.all);
    case "merge":
      return mergeBranch(repository, action.branch, action.ffOnly);
    case "cherry-pick":
      return cherryPick(repository, action.commit);
    case "revert":
      return revertCommit(repository, action.commit);
    case "rebase":
      return rebaseBranch(repository, action.onto);
    case "interactive-rebase":
      return interactiveRebase(repository, action.onto, action.todo);
  }
}

// src/engine/validation.ts
function validateRepository(repository, target) {
  const unmet = [];
  const checks = [];
  const targetHead = Object.hasOwn(repository.branches, target.branch) ? repository.branches[target.branch] : void 0;
  const matchesSnapshot = targetHead !== void 0 && semanticEqual(getSnapshot(repository, targetHead), target.snapshot);
  if (targetHead === void 0) {
    unmet.push(`The required branch '${target.branch}' does not exist.`);
  } else if (!matchesSnapshot) {
    unmet.push(
      `Branch '${target.branch}' does not contain the target repository state.`
    );
  }
  checks.push({
    id: "snapshot",
    label: `${target.branch} matches the goal`,
    met: matchesSnapshot,
    goal: { type: "snapshot", branch: target.branch }
  });
  const onTarget = repository.currentBranch === target.branch;
  if (!onTarget) {
    unmet.push(`HEAD must finish on branch '${target.branch}'.`);
  }
  checks.push({ id: "head", label: `Finish on ${target.branch}`, met: onTarget, goal: { type: "head", branch: target.branch } });
  for (const [branch, expectedHead] of Object.entries(target.branchHeads ?? {})) {
    const met = Object.hasOwn(repository.branches, branch) && repository.branches[branch] === expectedHead;
    if (!met) {
      unmet.push(`Branch '${branch}' does not point to the required commit.`);
    }
    checks.push({
      id: `branch:${branch}`,
      label: `Leave ${branch} at ${expectedHead}`,
      met,
      goal: { type: "branch-head", branch, commit: expectedHead }
    });
  }
  if (target.requiredProvenance?.length) {
    const reachable = getReachableCommits(repository);
    const squashes = [];
    for (const requirement of target.requiredProvenance) {
      const found = reachable.some(
        (commit) => commit.provenance?.type === requirement.type && commit.provenance.sourceCommits?.includes(requirement.sourceCommit)
      );
      if (!found) {
        unmet.push(
          `History must include a ${requirement.type} of '${requirement.sourceCommit}'.`
        );
      }
      if (requirement.type === "squash") squashes.push({ sourceCommit: requirement.sourceCommit, met: found });
      else checks.push({
        id: `${requirement.type}:${requirement.sourceCommit}`,
        label: provenanceLabel(requirement),
        met: found,
        goal: { type: "provenance", provenance: requirement.type, commits: [requirement.sourceCommit] }
      });
    }
    if (squashes.length) {
      const sources = squashes.map((squash) => squash.sourceCommit);
      checks.push({
        id: `squash:${sources.join(",")}`,
        label: `Squash ${joinWords(sources)} into one commit`,
        met: squashes.every((squash) => squash.met),
        goal: { type: "provenance", provenance: "squash", commits: sources }
      });
    }
  }
  return { solved: unmet.length === 0, unmet, checks };
}
function provenanceLabel({ type, sourceCommit }) {
  switch (type) {
    case "revert":
      return `Undo ${sourceCommit} with git revert`;
    case "merge":
      return `Bring in ${sourceCommit} with a merge commit`;
    case "cherry-pick":
      return `Cherry-pick ${sourceCommit}`;
    case "rebase":
      return `Rebase ${sourceCommit} onto newer work (don't merge it)`;
    case "squash":
      return `Squash ${sourceCommit} into a combined commit`;
    case "original":
      return `Keep ${sourceCommit} in the history`;
  }
}
function joinWords(words) {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// src/puzzles/policy.ts
var DEFAULT_PUZZLE_LIMITS = {
  maxCommitIdLength: 48,
  maxBranchNameLength: 48,
  maxPuzzleIdLength: 64,
  maxSlugLength: 80,
  maxTitleLength: 120,
  maxDescriptionLength: 600,
  maxCommitMessageLength: 240,
  maxHintLength: 240,
  maxObjectiveLength: 240,
  maxSolutionCommandLength: 160,
  maxCommits: 25,
  maxBranches: 8,
  maxChangesPerCommit: 12,
  maxParentsPerCommit: 2,
  maxTotalChanges: 80,
  maxProvenanceSourcesPerCommit: 4,
  maxRequiredProvenance: 8,
  maxRequiredActions: 6,
  maxTargetBranchHeads: 8,
  maxHints: 6,
  maxObjectives: 10,
  maxSolutionCommands: 20,
  maxSemanticValueDepth: 8
};
var COMMIT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
var BRANCH_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._/-]*$/;
var PUZZLE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
var DEFAULT_DIFFICULTY_POLICY = {
  easy: { maxCommits: 8, maxBranches: 3, maxSolutionCommands: 5, minHints: 1 },
  medium: {
    minCommits: 3,
    maxCommits: 14,
    minBranches: 2,
    maxBranches: 5,
    minSolutionCommands: 2,
    maxSolutionCommands: 10
  },
  hard: {
    minCommits: 5,
    maxCommits: 25,
    minBranches: 2,
    maxBranches: 8,
    minSolutionCommands: 3,
    maxSolutionCommands: 20
  }
};

// src/puzzles/schema.ts
var kinds = /* @__PURE__ */ new Set(["daily", "lesson", "generated"]);
var difficulties = /* @__PURE__ */ new Set(["easy", "medium", "hard"]);
var commands = new Set(SUPPORTED_ACTION_TYPES);
var provenanceTypes = /* @__PURE__ */ new Set([
  "original",
  "cherry-pick",
  "revert",
  "merge",
  "rebase",
  "squash"
]);
function parsePuzzleCandidate(input) {
  const issues = [];
  const root = record(input, "$", issues);
  if (!root) return { issues };
  rejectUnknownKeys(
    root,
    [
      "schemaVersion",
      "id",
      "version",
      "kind",
      "slug",
      "title",
      "description",
      "difficulty",
      "objectives",
      "initialRepository",
      "target",
      "allowedCommands",
      "hints",
      "actionRequirements",
      "solutionCommands",
      "themeId",
      "publishedOn"
    ],
    "$",
    issues
  );
  const schemaVersion = integer2(root.schemaVersion, "$.schemaVersion", issues);
  const themeId = optionalString(root.themeId, "$.themeId", issues);
  const publishedOn = optionalString(root.publishedOn, "$.publishedOn", issues);
  const id = string(root.id, "$.id", issues);
  const version = integer2(root.version, "$.version", issues);
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
  const actionRequirements = root.actionRequirements === void 0 ? void 0 : parseActionRequirements(root.actionRequirements, "$.actionRequirements", issues);
  const solutionCommands = stringArray(root.solutionCommands, "$.solutionCommands", issues, false);
  if (schemaVersion !== void 0 && schemaVersion !== 1 && schemaVersion !== 2) {
    issue(issues, "schema.unsupported-version", "Only puzzle schema versions 1 and 2 are supported.", "$.schemaVersion");
  }
  if (schemaVersion === 2 && themeId !== "chicken-v1") {
    issue(issues, "schema.invalid-theme", "Puzzle schema version 2 requires themeId 'chicken-v1'.", "$.themeId");
  }
  if (publishedOn !== void 0 && !/^\d{4}-\d{2}-\d{2}$/.test(publishedOn)) {
    issue(issues, "schema.invalid-date", "publishedOn must use YYYY-MM-DD UTC format.", "$.publishedOn");
  }
  if (issues.length > 0 || schemaVersion !== 1 && schemaVersion !== 2 || id === void 0 || version === void 0 || kind === void 0 || slug === void 0 || title === void 0 || description === void 0 || difficulty === void 0 || repository === void 0 || target === void 0 || allowedCommands === void 0 || hints === void 0 || solutionCommands === void 0 || root.actionRequirements !== void 0 && actionRequirements === void 0) {
    return { issues };
  }
  return {
    issues,
    candidate: {
      schemaVersion,
      ...themeId === "chicken-v1" ? { themeId } : {},
      id,
      version,
      kind,
      slug,
      title,
      description,
      difficulty,
      ...publishedOn ? { publishedOn } : {},
      ...objectives ? { objectives } : {},
      initialRepository: repository,
      target,
      allowedCommands,
      hints,
      ...actionRequirements ? { actionRequirements } : {},
      solutionCommands
    }
  };
}
function parseRepository(value, path, issues) {
  const source = record(value, path, issues);
  if (!source) return void 0;
  rejectUnknownKeys(source, ["commits", "branches", "currentBranch", "head", "initialState", "nextGeneratedId"], path, issues);
  const commits = parseCommits(source.commits, `${path}.commits`, issues);
  const branches = stringRecord(source.branches, `${path}.branches`, issues);
  const currentBranch = string(source.currentBranch, `${path}.currentBranch`, issues);
  const head = string(source.head, `${path}.head`, issues);
  const initialState = jsonRecord(source.initialState, `${path}.initialState`, issues);
  const nextGeneratedId = integer2(source.nextGeneratedId, `${path}.nextGeneratedId`, issues);
  if (commits === void 0 || branches === void 0 || currentBranch === void 0 || head === void 0 || initialState === void 0 || nextGeneratedId === void 0) return void 0;
  return { commits, branches, currentBranch, head, initialState, nextGeneratedId };
}
function parseCommits(value, path, issues) {
  const source = record(value, path, issues);
  if (!source) return void 0;
  const commits = /* @__PURE__ */ Object.create(null);
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
    if (declaredId === void 0 || parents === void 0 || message === void 0 || changes === void 0) continue;
    commits[id] = { id: declaredId, parents, message, changes, ...provenance ? { provenance } : {} };
  }
  return commits;
}
function parseChanges(value, path, issues) {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array.", path);
    return void 0;
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
    if (type === void 0 || property === void 0 || from === void 0 || to === void 0) return [];
    return [{ type, property, from, to }];
  });
}
function parseTarget(value, path, issues) {
  const source = record(value, path, issues);
  if (!source) return void 0;
  rejectUnknownKeys(source, ["branch", "snapshot", "branchHeads", "requiredProvenance"], path, issues);
  const branch = string(source.branch, `${path}.branch`, issues);
  const snapshot = jsonRecord(source.snapshot, `${path}.snapshot`, issues);
  const branchHeads = source.branchHeads === void 0 ? void 0 : stringRecord(source.branchHeads, `${path}.branchHeads`, issues);
  const requiredProvenance = source.requiredProvenance === void 0 ? void 0 : parseRequiredProvenance(source.requiredProvenance, `${path}.requiredProvenance`, issues);
  if (branch === void 0 || snapshot === void 0 || source.branchHeads !== void 0 && branchHeads === void 0 || source.requiredProvenance !== void 0 && requiredProvenance === void 0) return void 0;
  return { branch, snapshot, ...branchHeads ? { branchHeads } : {}, ...requiredProvenance ? { requiredProvenance } : {} };
}
function parseActionRequirements(value, path, issues) {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array of action requirements.", path);
    return void 0;
  }
  const requirements = [];
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
        if (all !== void 0) requirements.push({ type, all });
        return;
      }
      case "merge": {
        rejectUnknownKeys(source, ["type", "ffOnly"], itemPath, issues);
        const ffOnly = boolean(source.ffOnly, `${itemPath}.ffOnly`, issues);
        if (ffOnly !== void 0) requirements.push({ type, ffOnly });
        return;
      }
      case "switch": {
        rejectUnknownKeys(source, ["type", "branch"], itemPath, issues);
        const branch = optionalString(source.branch, `${itemPath}.branch`, issues);
        if (branch !== void 0 || source.branch === void 0) {
          requirements.push({ type, ...branch === void 0 ? {} : { branch } });
        }
        return;
      }
      case "cherry-pick": {
        rejectUnknownKeys(source, ["type", "commit"], itemPath, issues);
        const commit = optionalString(source.commit, `${itemPath}.commit`, issues);
        if (commit !== void 0 || source.commit === void 0) {
          requirements.push({ type, ...commit === void 0 ? {} : { commit } });
        }
        return;
      }
      case "revert": {
        rejectUnknownKeys(source, ["type", "commit"], itemPath, issues);
        const commit = optionalString(source.commit, `${itemPath}.commit`, issues);
        if (commit !== void 0 || source.commit === void 0) {
          requirements.push({ type, ...commit === void 0 ? {} : { commit } });
        }
        return;
      }
      case "rebase":
      case "interactive-rebase": {
        rejectUnknownKeys(source, ["type", "onto"], itemPath, issues);
        const onto = optionalString(source.onto, `${itemPath}.onto`, issues);
        if (onto !== void 0 || source.onto === void 0) {
          requirements.push({ type, ...onto === void 0 ? {} : { onto } });
        }
        return;
      }
    }
  });
  return requirements;
}
function parseRequiredProvenance(value, path, issues) {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array.", path);
    return void 0;
  }
  return value.flatMap((raw, index) => {
    const itemPath = `${path}[${index}]`;
    const source = record(raw, itemPath, issues);
    if (!source) return [];
    rejectUnknownKeys(source, ["type", "sourceCommit"], itemPath, issues);
    const type = enumValue(source.type, provenanceTypes, `${itemPath}.type`, issues);
    const sourceCommit = string(source.sourceCommit, `${itemPath}.sourceCommit`, issues);
    return type !== void 0 && sourceCommit !== void 0 ? [{ type, sourceCommit }] : [];
  });
}
function parseProvenance(value, path, issues) {
  if (value === void 0) return void 0;
  const source = record(value, path, issues);
  if (!source) return void 0;
  rejectUnknownKeys(source, ["type", "sourceCommits"], path, issues);
  const type = enumValue(source.type, provenanceTypes, `${path}.type`, issues);
  const sourceCommits = source.sourceCommits === void 0 ? void 0 : stringArray(source.sourceCommits, `${path}.sourceCommits`, issues, false);
  if (type === void 0 || source.sourceCommits !== void 0 && sourceCommits === void 0) return void 0;
  return { type, ...sourceCommits ? { sourceCommits } : {} };
}
function record(value, path, issues) {
  if (!isPlainRecord(value)) {
    issue(issues, "schema.invalid-type", "Expected an object.", path);
    return void 0;
  }
  return value;
}
function stringRecord(value, path, issues) {
  const source = record(value, path, issues);
  if (!source) return void 0;
  const result = /* @__PURE__ */ Object.create(null);
  for (const [key, item] of Object.entries(source)) {
    const parsed = string(item, `${path}.${key}`, issues);
    if (parsed !== void 0) result[key] = parsed;
  }
  return result;
}
function jsonRecord(value, path, issues) {
  const source = record(value, path, issues);
  if (!source) return void 0;
  const result = /* @__PURE__ */ Object.create(null);
  for (const [key, item] of Object.entries(source)) {
    const parsed = jsonValue(item, `${path}.${key}`, issues);
    if (parsed !== void 0) result[key] = parsed;
  }
  return result;
}
function jsonValue(value, path, issues, ancestors2 = /* @__PURE__ */ new Set(), remainingDepth = 64) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    issue(issues, "semantic.non-json-value", "Semantic values must be finite JSON values.", path);
    return void 0;
  }
  if (remainingDepth <= 0 || typeof value !== "object" || ancestors2.has(value)) {
    issue(issues, "semantic.non-json-value", "Semantic values must be JSON-serializable.", path);
    return void 0;
  }
  const nextAncestors = new Set(ancestors2).add(value);
  if (Array.isArray(value)) {
    const result2 = [];
    value.forEach((item, index) => {
      const parsed = jsonValue(item, `${path}[${index}]`, issues, nextAncestors, remainingDepth - 1);
      if (parsed !== void 0) result2.push(parsed);
    });
    return result2;
  }
  if (!isPlainRecord(value)) {
    issue(issues, "semantic.non-json-value", "Semantic values must be plain JSON objects.", path);
    return void 0;
  }
  const result = /* @__PURE__ */ Object.create(null);
  Object.entries(value).forEach(([key, item]) => {
    const parsed = jsonValue(item, `${path}.${key}`, issues, nextAncestors, remainingDepth - 1);
    if (parsed !== void 0) result[key] = parsed;
  });
  return result;
}
function string(value, path, issues) {
  if (typeof value !== "string") {
    issue(issues, "schema.invalid-type", "Expected a string.", path);
    return void 0;
  }
  return value;
}
function optionalString(value, path, issues) {
  return value === void 0 ? void 0 : string(value, path, issues);
}
function boolean(value, path, issues) {
  if (typeof value !== "boolean") {
    issue(issues, "schema.invalid-type", "Expected a boolean.", path);
    return void 0;
  }
  return value;
}
function integer2(value, path, issues) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issue(issues, "schema.invalid-type", "Expected an integer.", path);
    return void 0;
  }
  return value;
}
function stringArray(value, path, issues, optional) {
  if (value === void 0 && optional) return void 0;
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array of strings.", path);
    return void 0;
  }
  const result = [];
  value.forEach((item, index) => {
    const parsed = string(item, `${path}[${index}]`, issues);
    if (parsed !== void 0) result.push(parsed);
  });
  return result;
}
function enumArray(value, values, path, issues) {
  if (!Array.isArray(value)) {
    issue(issues, "schema.invalid-type", "Expected an array.", path);
    return void 0;
  }
  const result = [];
  value.forEach((item, index) => {
    const parsed = enumValue(item, values, `${path}[${index}]`, issues);
    if (parsed) result.push(parsed);
  });
  return result;
}
function enumValue(value, values, path, issues) {
  if (typeof value === "string" && values.has(value)) return value;
  issue(issues, "schema.invalid-enum", `Expected one of: ${[...values].join(", ")}.`, path);
  return void 0;
}
function rejectUnknownKeys(source, allowed, path, issues) {
  Object.keys(source).filter((key) => !allowed.includes(key)).forEach((key) => {
    issue(issues, "schema.unknown-property", "This property is not part of puzzle schema v1.", `${path}.${key}`);
  });
}
function isPlainRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function issue(issues, code, message, path) {
  issues.push({ code, message, path });
}

// src/puzzles/completion.ts
function validatePuzzleCompletion(repository, target, executed, requirements = []) {
  const base = validateRepository(repository, target);
  const actions = executed.map((entry) => "action" in entry ? entry.action : entry);
  const unmet = [...base.unmet];
  const checks = [...base.checks];
  requirements.forEach((requirement, index) => {
    const met = actions.some((action) => matchesActionRequirement(action, requirement));
    if (!met) {
      unmet.push(`A required action has not been executed: ${formatRequirement(requirement)}.`);
    }
    const command = formatRequirement(requirement);
    checks.push({ id: `action:${index}`, label: `Run ${command}`, met, goal: { type: "action", command } });
  });
  return { solved: unmet.length === 0, unmet, checks };
}
function matchesActionRequirement(action, requirement) {
  if (action.type !== requirement.type) return false;
  switch (action.type) {
    case "log":
      return requirement.type === "log" && action.all === requirement.all;
    case "merge":
      return requirement.type === "merge" && action.ffOnly === requirement.ffOnly;
    case "switch":
      return requirement.type === "switch" && (requirement.branch === void 0 || action.branch === requirement.branch);
    case "cherry-pick":
    case "revert":
      return requirement.type === action.type && (requirement.commit === void 0 || action.commit === requirement.commit);
    case "rebase":
    case "interactive-rebase":
      return requirement.type === action.type && (requirement.onto === void 0 || action.onto === requirement.onto);
  }
}
function formatRequirement(requirement) {
  switch (requirement.type) {
    case "log":
      return requirement.all ? "git log --all" : "git log";
    case "merge":
      return requirement.ffOnly ? "git merge --ff-only <branch>" : "git merge <branch>";
    case "switch":
      return requirement.branch ? `git switch ${requirement.branch}` : "git switch";
    case "cherry-pick":
      return requirement.commit ? `git cherry-pick ${requirement.commit}` : "git cherry-pick";
    case "revert":
      return requirement.commit ? `git revert ${requirement.commit}` : "git revert";
    case "rebase":
      return requirement.onto ? `git rebase ${requirement.onto}` : "git rebase <branch>";
    case "interactive-rebase":
      return requirement.onto ? `git rebase -i ${requirement.onto}` : "git rebase -i <branch>";
  }
}

// src/puzzles/validateCandidate.ts
function validatePuzzleCandidate(input, config) {
  const parsed = parsePuzzleCandidate(input);
  if (!parsed.candidate) return { ok: false, issues: parsed.issues };
  const candidate = parsed.candidate;
  const issues = [...parsed.issues];
  const limits = { ...DEFAULT_PUZZLE_LIMITS, ...config.limits };
  validateIdentity(candidate, limits, issues);
  validateText(candidate, limits, issues);
  validateRepositoryStructure(candidate.initialRepository, limits, issues);
  validateSemanticState(candidate, config.semantic, limits, issues);
  validateTarget(candidate, config.semantic, limits, issues);
  validateAllowedCommands(candidate, issues);
  validateActionRequirements(candidate, limits, issues);
  validateDifficulty(candidate, limits, config.difficultyPolicy ?? DEFAULT_DIFFICULTY_POLICY, issues);
  if (issues.length > 0) return { ok: false, issues };
  validateHistoricalChangePreconditions(candidate.initialRepository, issues);
  if (issues.length > 0) return { ok: false, issues };
  const initialValidation = validatePuzzleCompletion(
    candidate.initialRepository,
    candidate.target,
    [],
    candidate.actionRequirements
  );
  if (initialValidation.solved) {
    add(issues, "target.initially-solved", "The initial repository already satisfies the target.", "$.initialRepository");
  } else {
    replaySolution(candidate, issues);
  }
  if (issues.length > 0) return { ok: false, issues };
  const { solutionCommands, ...puzzle } = candidate;
  return {
    ok: true,
    value: {
      puzzle,
      privateMetadata: { solutionCommands: [...solutionCommands] }
    }
  };
}
function validateHistoricalChangePreconditions(repository, issues) {
  for (const [id, commit] of Object.entries(repository.commits)) {
    try {
      const baseline = commit.parents[0] ? getSnapshot(repository, commit.parents[0]) : repository.initialState;
      applyChanges(baseline, commit.changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Commit changes do not apply to its first parent.";
      add(issues, "repository.incorrect-change-from", message, `$.initialRepository.commits.${id}.changes`);
    }
  }
}
function validateIdentity(candidate, limits, issues) {
  if (!PUZZLE_ID_PATTERN.test(candidate.id) || candidate.id.length > limits.maxPuzzleIdLength) {
    add(issues, "identity.invalid-puzzle-id", "Puzzle IDs must be lowercase kebab-case within the configured length limit.", "$.id");
  }
  if (!PUZZLE_ID_PATTERN.test(candidate.slug) || candidate.slug.length > limits.maxSlugLength) {
    add(issues, "identity.invalid-slug", "Slugs must be lowercase kebab-case within the configured length limit.", "$.slug");
  }
  if (candidate.version < 1) {
    add(issues, "identity.invalid-version", "Puzzle version must be a positive integer.", "$.version");
  }
  if (candidate.initialRepository.nextGeneratedId < 1) {
    add(issues, "repository.invalid-generated-id", "nextGeneratedId must be a positive integer.", "$.initialRepository.nextGeneratedId");
  }
}
function validateText(candidate, limits, issues) {
  text(candidate.title, limits.maxTitleLength, "$.title", issues);
  text(candidate.description, limits.maxDescriptionLength, "$.description", issues);
  boundedStrings(candidate.hints, limits.maxHints, limits.maxHintLength, "$.hints", issues, "content.hints-too-large");
  boundedStrings(candidate.objectives ?? [], limits.maxObjectives, limits.maxObjectiveLength, "$.objectives", issues, "content.objectives-too-large");
  boundedStrings(candidate.solutionCommands, limits.maxSolutionCommands, limits.maxSolutionCommandLength, "$.solutionCommands", issues, "content.solution-too-large");
}
function validateRepositoryStructure(repository, limits, issues) {
  const commits = Object.entries(repository.commits);
  const branches = Object.entries(repository.branches);
  if (commits.length === 0) add(issues, "repository.empty-graph", "A puzzle repository requires at least one commit.", "$.initialRepository.commits");
  if (commits.length > limits.maxCommits) add(issues, "limits.commits", `Repository contains more than ${limits.maxCommits} commits.`, "$.initialRepository.commits");
  if (branches.length === 0) add(issues, "repository.empty-branches", "A puzzle repository requires at least one branch.", "$.initialRepository.branches");
  if (branches.length > limits.maxBranches) add(issues, "limits.branches", `Repository contains more than ${limits.maxBranches} branches.`, "$.initialRepository.branches");
  let changeCount = 0;
  for (const [id, commit] of commits) {
    const path = `$.initialRepository.commits.${id}`;
    if (!validCommitId(id, limits) || !validCommitId(commit.id, limits)) {
      add(issues, "repository.invalid-commit-id", "Commit IDs must start with a letter and use only letters, numbers, underscores, or hyphens within the configured length limit.", `${path}.id`);
    }
    if (commit.id !== id) add(issues, "repository.commit-id-mismatch", "The commit object's id must match its map key.", `${path}.id`);
    text(commit.message, limits.maxCommitMessageLength, `${path}.message`, issues);
    if (commit.parents.length > limits.maxParentsPerCommit) add(issues, "limits.parents-per-commit", `A commit may contain at most ${limits.maxParentsPerCommit} parents.`, `${path}.parents`);
    if (commit.changes.length > limits.maxChangesPerCommit) add(issues, "limits.changes-per-commit", `A commit may contain at most ${limits.maxChangesPerCommit} changes.`, `${path}.changes`);
    changeCount += commit.changes.length;
    for (const [parentIndex, parent] of commit.parents.entries()) {
      if (!Object.hasOwn(repository.commits, parent)) add(issues, "repository.missing-parent", `Parent commit '${parent}' does not exist.`, `${path}.parents[${parentIndex}]`);
    }
  }
  if (changeCount > limits.maxTotalChanges) add(issues, "limits.total-changes", `Repository contains more than ${limits.maxTotalChanges} semantic changes.`, "$.initialRepository.commits");
  for (const [branch, head] of branches) {
    if (!validBranchName(branch, limits)) add(issues, "repository.invalid-branch-name", "Branch names must start with a letter and use only letters, numbers, dots, underscores, hyphens, or slashes within the configured length limit.", `$.initialRepository.branches.${branch}`);
    if (!Object.hasOwn(repository.commits, head)) add(issues, "repository.missing-branch-head", `Branch '${branch}' points to unknown commit '${head}'.`, `$.initialRepository.branches.${branch}`);
  }
  if (!Object.hasOwn(repository.branches, repository.currentBranch)) add(issues, "repository.missing-current-branch", "currentBranch must name an existing branch.", "$.initialRepository.currentBranch");
  if (!Object.hasOwn(repository.commits, repository.head)) add(issues, "repository.missing-head", "head must reference an existing commit.", "$.initialRepository.head");
  if (!Object.hasOwn(repository.branches, repository.currentBranch) || repository.branches[repository.currentBranch] !== repository.head) add(issues, "repository.head-mismatch", "head must equal the current branch head.", "$.initialRepository.head");
  if (!hasParentReferenceIssues(repository, issues) && hasCycle(repository)) add(issues, "repository.cyclic-graph", "The commit graph must be acyclic.", "$.initialRepository.commits");
}
function validateSemanticState(candidate, policy, limits, issues) {
  validateSnapshot(candidate.initialRepository.initialState, policy, limits, "$.initialRepository.initialState", issues);
  for (const [id, commit] of Object.entries(candidate.initialRepository.commits)) {
    commit.changes.forEach((change, index) => validateChange(change, policy, limits, `$.initialRepository.commits.${id}.changes[${index}]`, issues));
    validateProvenance(commit, candidate.initialRepository, limits, `$.initialRepository.commits.${id}.provenance`, issues);
  }
}
function validateTarget(candidate, policy, limits, issues) {
  const { target, initialRepository: repository } = candidate;
  if (!validBranchName(target.branch, limits)) add(issues, "target.invalid-branch", "The required target branch name is invalid.", "$.target.branch");
  if (!Object.hasOwn(repository.branches, target.branch)) add(issues, "target.missing-branch", `The required target branch '${target.branch}' does not exist.`, "$.target.branch");
  validateSnapshot(target.snapshot, policy, limits, "$.target.snapshot", issues);
  if (Object.keys(target.branchHeads ?? {}).length > limits.maxTargetBranchHeads) add(issues, "limits.target-branch-heads", `At most ${limits.maxTargetBranchHeads} target branch-head invariants are allowed.`, "$.target.branchHeads");
  for (const [branch, commit] of Object.entries(target.branchHeads ?? {})) {
    if (!validBranchName(branch, limits)) add(issues, "target.invalid-branch", "A target branch invariant has an invalid branch name.", `$.target.branchHeads.${branch}`);
    if (!Object.hasOwn(repository.branches, branch)) add(issues, "target.missing-invariant-branch", `Target invariant references unknown branch '${branch}'.`, `$.target.branchHeads.${branch}`);
    if (!Object.hasOwn(repository.commits, commit)) add(issues, "target.missing-invariant-commit", `Target invariant references unknown commit '${commit}'.`, `$.target.branchHeads.${branch}`);
  }
  if ((target.requiredProvenance ?? []).length > limits.maxRequiredProvenance) add(issues, "limits.required-provenance", `At most ${limits.maxRequiredProvenance} history requirements are allowed.`, "$.target.requiredProvenance");
  (target.requiredProvenance ?? []).forEach((requirement, index) => {
    if (!Object.hasOwn(repository.commits, requirement.sourceCommit)) add(issues, "target.missing-provenance-source", `History requirement references unknown commit '${requirement.sourceCommit}'.`, `$.target.requiredProvenance[${index}].sourceCommit`);
  });
}
function validateChange(change, policy, limits, path, issues) {
  if (change.type !== "set") add(issues, "semantic.unsupported-operation", `Semantic operation '${change.type}' is not supported.`, `${path}.type`);
  if (!Object.hasOwn(policy.properties, change.property)) add(issues, "semantic.disallowed-property", `Property '${change.property}' is not allowed by this puzzle policy.`, `${path}.property`);
  validateValue(change.from, change.property, policy, limits, `${path}.from`, issues);
  validateValue(change.to, change.property, policy, limits, `${path}.to`, issues);
}
function validateSnapshot(snapshot, policy, limits, path, issues) {
  const required = policy.requiredProperties ?? Object.keys(policy.properties);
  for (const property of Object.keys(snapshot)) {
    if (!Object.hasOwn(policy.properties, property)) add(issues, "semantic.disallowed-property", `Property '${property}' is not allowed by this puzzle policy.`, `${path}.${property}`);
    validateValue(snapshot[property], property, policy, limits, `${path}.${property}`, issues);
  }
  for (const property of required) {
    if (!Object.hasOwn(snapshot, property)) add(issues, "semantic.incomplete-state", `The complete semantic state must include '${property}'.`, path);
  }
}
function validateValue(value, property, policy, limits, path, issues) {
  if (!isJson(value, limits.maxSemanticValueDepth)) {
    add(issues, "semantic.non-json-value", "Semantic values must be finite JSON-serializable values within the configured depth limit.", path);
    return;
  }
  const allowed = policy.properties[property];
  if (allowed && !allowed.some((candidate) => semanticEqual(candidate, value))) add(issues, "semantic.disallowed-value", `Value is not allowed for semantic property '${property}'.`, path);
}
function validateProvenance(commit, repository, limits, path, issues) {
  if (!commit.provenance) return;
  if ((commit.provenance.sourceCommits ?? []).length > limits.maxProvenanceSourcesPerCommit) add(issues, "limits.provenance-sources-per-commit", `A commit may list at most ${limits.maxProvenanceSourcesPerCommit} provenance sources.`, `${path}.sourceCommits`);
  for (const [index, source] of (commit.provenance.sourceCommits ?? []).entries()) {
    if (!Object.hasOwn(repository.commits, source)) add(issues, "repository.missing-provenance-source", `Provenance references unknown commit '${source}'.`, `${path}.sourceCommits[${index}]`);
  }
}
function validateAllowedCommands(candidate, issues) {
  const unique = new Set(candidate.allowedCommands);
  if (unique.size !== candidate.allowedCommands.length) add(issues, "commands.duplicate-allowed-command", "allowedCommands must not contain duplicates.", "$.allowedCommands");
  if (candidate.allowedCommands.length === 0) add(issues, "commands.empty-allowed-commands", "A puzzle must allow at least one supported command.", "$.allowedCommands");
}
function validateActionRequirements(candidate, limits, issues) {
  if ((candidate.actionRequirements ?? []).length > limits.maxRequiredActions) {
    add(issues, "limits.required-actions", `At most ${limits.maxRequiredActions} action requirements are allowed.`, "$.actionRequirements");
  }
}
function validateDifficulty(candidate, limits, policy, issues) {
  const constraint = policy[candidate.difficulty];
  if (!constraint) {
    add(issues, "difficulty.missing-policy", `No difficulty policy exists for '${candidate.difficulty}'.`, "$.difficulty");
    return;
  }
  const metrics = [
    ["commits", Object.keys(candidate.initialRepository.commits).length, constraint.minCommits, constraint.maxCommits, "$.initialRepository.commits"],
    ["branches", Object.keys(candidate.initialRepository.branches).length, constraint.minBranches, constraint.maxBranches, "$.initialRepository.branches"],
    ["solution commands", candidate.solutionCommands.length, constraint.minSolutionCommands, Math.min(constraint.maxSolutionCommands ?? limits.maxSolutionCommands, limits.maxSolutionCommands), "$.solutionCommands"],
    ["hints", candidate.hints.length, constraint.minHints, constraint.maxHints, "$.hints"]
  ];
  metrics.forEach(([label, value, min, max, path]) => {
    if (min !== void 0 && value < min) add(issues, "difficulty.below-minimum", `${candidate.difficulty} puzzles require at least ${min} ${label}.`, path);
    if (max !== void 0 && value > max) add(issues, "difficulty.above-maximum", `${candidate.difficulty} puzzles allow at most ${max} ${label}.`, path);
  });
}
function replaySolution(candidate, issues) {
  let repository = cloneRepository(candidate.initialRepository);
  const actions = [];
  candidate.solutionCommands.forEach((command, index) => {
    const path = `$.solutionCommands[${index}]`;
    const parsed = parseGitCommand(command);
    if (!parsed.ok) {
      add(issues, "solution.parse-failed", parsed.error, path);
      return;
    }
    if (!candidate.allowedCommands.includes(parsed.action.type)) {
      add(issues, "solution.disallowed-command", `Solution command uses '${parsed.action.type}', which is not allowed by this puzzle.`, path);
      return;
    }
    const result = executeCommand(repository, command);
    if (!result.ok) {
      const code = result.error.includes("Semantic conflict") || result.error.includes("Merge conflict") ? "solution.conflict" : "solution.execution-failed";
      add(issues, code, result.error, path);
      return;
    }
    repository = result.repository;
    actions.push(result.action);
  });
  if (issues.some((item) => item.path.startsWith("$.solutionCommands"))) return;
  const validation = validatePuzzleCompletion(
    repository,
    candidate.target,
    actions,
    candidate.actionRequirements
  );
  if (!validation.solved) add(issues, "solution.target-not-met", validation.unmet.join(" "), "$.solutionCommands");
}
function hasParentReferenceIssues(repository, issues) {
  return issues.some((issue2) => issue2.code === "repository.missing-parent" && issue2.path.startsWith("$.initialRepository"));
}
function hasCycle(repository) {
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const visit = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    if (!Object.hasOwn(repository.commits, id)) return false;
    visiting.add(id);
    const cyclic = repository.commits[id].parents.some(visit);
    visiting.delete(id);
    visited.add(id);
    return cyclic;
  };
  return Object.keys(repository.commits).some(visit);
}
function validCommitId(id, limits) {
  return id.length <= limits.maxCommitIdLength && COMMIT_ID_PATTERN.test(id);
}
function validBranchName(name, limits) {
  return name.length <= limits.maxBranchNameLength && BRANCH_NAME_PATTERN.test(name) && !name.includes("..") && !name.endsWith("/") && !name.endsWith(".");
}
function boundedStrings(values, maxCount, maxLength, path, issues, sizeCode) {
  if (values.length > maxCount) add(issues, sizeCode, `At most ${maxCount} entries are allowed.`, path);
  values.forEach((value, index) => text(value, maxLength, `${path}[${index}]`, issues));
}
function text(value, maximum, path, issues) {
  if (value.trim().length === 0) add(issues, "content.empty-string", "This text field must not be empty.", path);
  if (value.length > maximum) add(issues, "limits.string-length", `This string exceeds the configured limit of ${maximum} characters.`, path);
}
function isJson(value, remainingDepth) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (remainingDepth <= 0 || typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return value.every((item) => isJson(item, remainingDepth - 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  return Object.values(value).every((item) => isJson(item, remainingDepth - 1));
}
function add(issues, code, message, path) {
  issues.push({ code, message, path });
}

// src/puzzles/generation/validateBrief.ts
function validateCandidateAgainstBrief(input, brief) {
  const validated = validatePuzzleCandidate(input, {
    semantic: CHICKEN_V2_SEMANTIC_POLICY,
    difficultyPolicy: {
      easy: {},
      medium: {},
      hard: {}
    }
  });
  if (!validated.ok) return validated;
  const candidate = input;
  const issues = [];
  equal(candidate.schemaVersion, 2, "brief.schema-version", "Candidate must use schema version 2.", "$.schemaVersion", issues);
  equal(candidate.themeId, "chicken-v1", "brief.theme", "Candidate must use the chicken-v1 theme.", "$.themeId", issues);
  equal(candidate.kind, "daily", "brief.kind", "Candidate must be a daily puzzle.", "$.kind", issues);
  equal(candidate.difficulty, brief.difficulty, "brief.difficulty", "Candidate difficulty differs from the reserved daily difficulty.", "$.difficulty", issues);
  equal(candidate.publishedOn, brief.date, "brief.date", "Candidate date differs from the reserved UTC date.", "$.publishedOn", issues);
  equal(Object.keys(candidate.initialRepository.branches).length, brief.branchCount, "brief.branch-count", "Candidate has the wrong number of branches.", "$.initialRepository.branches", issues);
  equal(Object.keys(candidate.initialRepository.commits).length, brief.commitCount, "brief.commit-count", "Candidate has the wrong number of commits.", "$.initialRepository.commits", issues);
  equal(candidate.hints.length, brief.hintCount, "brief.hint-count", "Candidate has the wrong number of hints.", "$.hints", issues);
  if (!semanticEqual(candidate.target.snapshot, brief.targetState)) {
    add2(issues, "brief.target-state", "Candidate target accessories or colors differ from the persisted brief.", "$.target.snapshot");
  }
  validateImmutableGenerationShape(candidate, brief, issues);
  validateCommitChangePreconditions(candidate, issues);
  validateGraphArchetype(candidate, brief, issues);
  if (candidate.target.branch !== "main") {
    add2(issues, "brief.target-branch", "Daily puzzles must finish on main.", "$.target.branch");
  }
  if (!sameSet(candidate.allowedCommands, brief.allowedCommands)) {
    add2(issues, "brief.allowed-commands", "Candidate allowed commands differ from the persisted brief.", "$.allowedCommands");
  }
  if (candidate.solutionCommands.length < brief.solutionLength.min || candidate.solutionCommands.length > brief.solutionLength.max) {
    add2(issues, "brief.solution-length", "Candidate solution length is outside the brief range.", "$.solutionCommands");
  }
  const concepts = conceptsIn(candidate.solutionCommands);
  brief.requiredConcepts.forEach((concept) => {
    if (!concepts.has(concept)) add2(issues, "brief.missing-concept", `Proof solution does not demonstrate '${concept}'.`, "$.solutionCommands");
  });
  if (!candidate.description.toLowerCase().includes(brief.storyTheme.toLowerCase().split(" ")[0])) {
    add2(issues, "brief.story-theme", `Description must clearly reference the '${brief.storyTheme}' story theme.`, "$.description");
  }
  return { ok: issues.length === 0, issues };
}
function validateImmutableGenerationShape(candidate, brief, issues) {
  const expectedCommitIds = Array.from({ length: brief.commitCount }, (_, index) => `c${index + 1}`);
  const expectedBranches = ["main", "feature", "style", "polish"].slice(0, brief.branchCount);
  const commitIds = Object.keys(candidate.initialRepository.commits).sort();
  const branches = Object.keys(candidate.initialRepository.branches).sort();
  if (!sameSet(commitIds, expectedCommitIds)) add2(issues, "brief.commit-ids", "Daily generation must use exactly c1 through cN, each exactly once.", "$.initialRepository.commits");
  if (!sameSet(branches, expectedBranches)) add2(issues, "brief.branch-set", "Daily generation must use the canonical branch names for its branch count.", "$.initialRepository.branches");
  if (candidate.initialRepository.currentBranch !== "main") add2(issues, "brief.initial-branch", "Daily generation must start on main.", "$.initialRepository.currentBranch");
  if (candidate.initialRepository.head !== candidate.initialRepository.branches.main) add2(issues, "brief.initial-head", "Daily generation HEAD must equal the main branch head.", "$.initialRepository.head");
  if (!semanticEqual(candidate.initialRepository.initialState, EMPTY_CHICKEN_STATE)) add2(issues, "brief.initial-state", "Daily generation must use the canonical empty chicken baseline.", "$.initialRepository.initialState");
  if (candidate.initialRepository.nextGeneratedId !== 1) add2(issues, "brief.generated-id-baseline", "Daily generation must begin generated IDs at g1.", "$.initialRepository.nextGeneratedId");
  if (Object.keys(candidate.target.branchHeads ?? {}).length !== 0) add2(issues, "brief.target-branch-heads", "Daily generation does not permit model-defined branch-head requirements.", "$.target.branchHeads");
  if ((candidate.target.requiredProvenance ?? []).length !== 0) add2(issues, "brief.target-provenance", "Daily generation does not permit model-defined provenance requirements.", "$.target.requiredProvenance");
  for (const [id, commit] of Object.entries(candidate.initialRepository.commits)) {
    const index = Number(id.slice(1));
    if (!Number.isInteger(index) || id !== `c${index}`) continue;
    for (const parent of commit.parents) {
      const parentIndex = Number(parent.slice(1));
      if (!Number.isInteger(parentIndex) || parent !== `c${parentIndex}` || parentIndex >= index) {
        add2(issues, "brief.forward-parent", "A generated commit may reference only an earlier cN parent.", `$.initialRepository.commits.${id}.parents`);
      }
    }
    if (id === "c1" && commit.parents.length !== 0) add2(issues, "brief.root-parent", "c1 must be the root commit with no parents.", `$.initialRepository.commits.${id}.parents`);
    if (commit.provenance?.type !== "original" || (commit.provenance.sourceCommits ?? []).length !== 0) add2(issues, "brief.initial-provenance", "Initial generated commits must have empty original provenance.", `$.initialRepository.commits.${id}.provenance`);
  }
}
function validateCommitChangePreconditions(candidate, issues) {
  const commits = candidate.initialRepository.commits;
  for (const id of Object.keys(commits).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))) {
    const commit = commits[id];
    if (commit.parents.some((parent) => !Object.hasOwn(commits, parent))) continue;
    try {
      const parentSnapshot = commit.parents[0] ? getSnapshot(candidate.initialRepository, commit.parents[0]) : candidate.initialRepository.initialState;
      applyChanges(parentSnapshot, commit.changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Commit semantic precondition failed.";
      add2(issues, "repository.incorrect-change-from", message, `$.initialRepository.commits.${id}.changes`);
    }
  }
}
function validateGraphArchetype(candidate, brief, issues) {
  const repository = candidate.initialRepository;
  const mainHead = repository.branches.main;
  const otherHeads = Object.entries(repository.branches).filter(([branch]) => branch !== "main").map(([, head]) => head);
  const fail = (message) => add2(issues, "brief.graph-archetype", message, "$.initialRepository");
  const actions = candidate.solutionCommands.flatMap((command) => {
    const parsed = parseGitCommand(command);
    return parsed.ok ? [parsed.action] : [];
  });
  if (!mainHead) return fail("The requested graph archetype requires a main branch.");
  switch (brief.graphArchetype) {
    case "fast-forward":
      if (!otherHeads.some((head) => isAncestor2(repository, mainHead, head) && head !== mainHead)) {
        fail("Fast-forward briefs require another branch to descend from main.");
      }
      if (!actions.some((action) => action.type === "merge" && action.ffOnly && action.branch !== "main")) {
        fail("Fast-forward briefs require a --ff-only merge of a side branch in the proof.");
      }
      return;
    case "divergent-merge":
      if (!otherHeads.some((head) => !isAncestor2(repository, mainHead, head) && !isAncestor2(repository, head, mainHead) && shareAncestor(repository, head, mainHead))) {
        fail("Divergent-merge briefs require main and another branch to have diverged from a shared ancestor.");
      }
      if (!actions.some((action) => action.type === "merge" && !action.ffOnly && action.branch !== "main")) {
        fail("Divergent-merge briefs require a non-fast-forward side-branch merge in the proof.");
      }
      return;
    case "curate-and-undo":
      if (!brief.requiredConcepts.includes("revert") || !brief.requiredConcepts.includes("cherry-pick")) {
        fail("Curate-and-undo briefs require revert plus cherry-pick.");
      }
      const reverted = actions.filter((action) => action.type === "revert" && repository.commits[action.commit]?.parents.length === 1);
      const imported = actions.filter((action) => action.type === "cherry-pick");
      if (reverted.length === 0 || imported.length === 0) {
        fail("Curate-and-undo proofs must revert a normal commit and import useful work.");
      }
      if (reverted.some((action) => imported.some((pick2) => changesOverlap(repository, action.commit, pick2.commit)))) {
        fail("Curate-and-undo must keep reverted and imported accessory properties disjoint.");
      }
      return;
    case "multi-branch-curation":
      if (Object.keys(repository.branches).length < 3 || brief.requiredConcepts.length < 3) {
        fail("Multi-branch curation requires at least three branches and three proof concepts.");
      }
      const picked = actions.filter((action) => action.type === "cherry-pick").map((action) => action.commit);
      if (new Set(picked).size < 2) {
        fail("Multi-branch curation proofs must import at least two distinct commits.");
      }
      if (picked.some((id, index) => picked.slice(index + 1).some((other) => changesOverlap(repository, id, other)))) {
        fail("Multi-branch curation must assign imported commits different accessory properties.");
      }
      return;
    case "single-transfer":
      if (otherHeads.length !== 1 || otherHeads[0] === mainHead) {
        fail("Single-transfer briefs require exactly one distinct side branch.");
      }
      if (!actions.some((action) => action.type === "cherry-pick")) {
        fail("Single-transfer briefs require a literal cherry-pick proof step.");
      }
  }
}
function changesOverlap(repository, left, right) {
  const leftProperties = new Set((repository.commits[left]?.changes ?? []).map((change) => change.property));
  return (repository.commits[right]?.changes ?? []).some((change) => leftProperties.has(change.property));
}
function isAncestor2(repository, ancestor, descendant) {
  const pending = [descendant];
  const seen = /* @__PURE__ */ new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === ancestor) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...repository.commits[current]?.parents ?? []);
  }
  return false;
}
function shareAncestor(repository, left, right) {
  const leftAncestors = ancestors(repository, left);
  return [...ancestors(repository, right)].some((commit) => leftAncestors.has(commit));
}
function ancestors(repository, start) {
  const result = /* @__PURE__ */ new Set();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop();
    if (result.has(current)) continue;
    result.add(current);
    pending.push(...repository.commits[current]?.parents ?? []);
  }
  return result;
}
function conceptsIn(commands2) {
  const result = /* @__PURE__ */ new Set();
  commands2.forEach((command) => {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) return;
    if (parsed.action.type === "merge" && parsed.action.ffOnly) result.add("ff-only");
    else result.add(parsed.action.type);
  });
  return result;
}
function sameSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
function equal(actual, expected, code, message, path, issues) {
  if (actual !== expected) add2(issues, code, message, path);
}
function add2(issues, code, message, path) {
  issues.push({ code, message, path });
}

// src/puzzles/generation/guided.ts
var GUIDED_GOAL_MAX_LENGTH = 200;
var GUIDED_HINT_COUNT = 3;
var FOCUS_RULES = [
  {
    pattern: /\b(everything|all of it|all commands|challenge|advanced|several branches|many branches|multiple branches)\b/,
    focus: { graphArchetype: "multi-branch-curation", difficulty: "hard", topic: "combining several branches" }
  },
  {
    pattern: /\b(revert|undo|undoing|back ?out|roll ?back|remove a commit|bad commit|mistake)/,
    focus: { graphArchetype: "curate-and-undo", difficulty: "medium", topic: "undoing a commit with git revert" }
  },
  {
    pattern: /\b(cherry|pick|copy|single commit|one commit|port)/,
    focus: { graphArchetype: "single-transfer", difficulty: "easy", topic: "copying one commit with git cherry-pick" }
  },
  {
    pattern: /\b(ff|fast[- ]?forward|ff-only|linear)/,
    focus: { graphArchetype: "fast-forward", difficulty: "easy", topic: "fast-forward merges" }
  },
  {
    pattern: /\b(merge|merging|diverg|combine|integrat|join|conflict|rebase|squash)/,
    focus: { graphArchetype: "divergent-merge", difficulty: "medium", topic: "merging diverged branches" }
  },
  {
    pattern: /\b(switch|switching|checkout|branch|branches|head|log|history)\b/,
    focus: { graphArchetype: "fast-forward", difficulty: "easy", topic: "moving between branches" }
  }
];
var DEFAULT_FOCUS = {
  graphArchetype: "divergent-merge",
  difficulty: "medium",
  topic: "branches and merging"
};
function normalizeGuidedGoal(input) {
  if (typeof input !== "string") return void 0;
  const goal = input.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!goal || goal.length > GUIDED_GOAL_MAX_LENGTH) return void 0;
  return goal;
}
function classifyGuidedGoal(goal) {
  const text2 = goal.toLowerCase();
  return FOCUS_RULES.find((rule) => rule.pattern.test(text2))?.focus ?? DEFAULT_FOCUS;
}
function createGuidedBrief(goal, date, seed) {
  const focus = classifyGuidedGoal(goal);
  const brief = createGenerationBrief(date, focus.difficulty, seed, {
    graphArchetype: focus.graphArchetype,
    hintCount: GUIDED_HINT_COUNT
  });
  return { brief, focus };
}
function toGuidedPuzzle(candidate, lessonId) {
  const { solutionCommands, publishedOn: _publishedOn, ...rest } = candidate;
  const id = `guided-${lessonId}`;
  return {
    puzzle: { ...rest, id, slug: id, version: 1, kind: "generated" },
    solutionCommands
  };
}
export {
  CHICKEN_V2_SEMANTIC_POLICY,
  createGenerationBrief,
  createGuidedBrief,
  normalizeGuidedGoal,
  toGuidedPuzzle,
  validateCandidateAgainstBrief,
  validatePuzzleCandidate
};
