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
  requiredProperties: CHICKEN_ACCESSORY_SLOTS,
  validateState: validateChickenVisualState
};
function validateChickenVisualState(state) {
  if (state.hat !== "none" && state.crest !== "none") {
    return "Hat and crest cannot be used together because the hat hides the crest.";
  }
  return void 0;
}

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
    accessories: [3, 4],
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
  for (const group of sample(random, ACCESSORY_GROUPS, count)) {
    const slot = pick(random, group);
    state[slot] = pick(random, CHICKEN_COLORS);
  }
  return state;
}
var ACCESSORY_GROUPS = [
  ["hat", "crest"],
  ["sunglasses"],
  ["scarf"],
  ["longLegs"]
];
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
  let hash2 = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash2 = Math.imul(hash2 ^ seed.charCodeAt(index), 3432918353);
    hash2 = hash2 << 13 | hash2 >>> 19;
  }
  return () => {
    hash2 = Math.imul(hash2 ^ hash2 >>> 16, 2246822507);
    hash2 = Math.imul(hash2 ^ hash2 >>> 13, 3266489909);
    hash2 ^= hash2 >>> 16;
    let value = hash2 += 1831565813;
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

// src/i18n/locales.ts
var LOCALES = ["en", "es", "ca"];
function isLocale(value) {
  return typeof value === "string" && LOCALES.includes(value);
}

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
      "publishedOn",
      "parCommands",
      "localizations"
    ],
    "$",
    issues
  );
  const schemaVersion = integer2(root.schemaVersion, "$.schemaVersion", issues);
  const themeId = optionalString(root.themeId, "$.themeId", issues);
  const publishedOn = optionalString(root.publishedOn, "$.publishedOn", issues);
  const parCommands = root.parCommands === void 0 ? void 0 : integer2(root.parCommands, "$.parCommands", issues);
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
  const localizations = root.localizations === void 0 ? void 0 : parseLocalizations(root.localizations, "$.localizations", issues);
  if (schemaVersion !== void 0 && schemaVersion !== 1 && schemaVersion !== 2) {
    issue(issues, "schema.unsupported-version", "Only puzzle schema versions 1 and 2 are supported.", "$.schemaVersion");
  }
  if (schemaVersion === 2 && themeId !== "chicken-v1") {
    issue(issues, "schema.invalid-theme", "Puzzle schema version 2 requires themeId 'chicken-v1'.", "$.themeId");
  }
  if (publishedOn !== void 0 && !/^\d{4}-\d{2}-\d{2}$/.test(publishedOn)) {
    issue(issues, "schema.invalid-date", "publishedOn must use YYYY-MM-DD UTC format.", "$.publishedOn");
  }
  if (issues.length > 0 || schemaVersion !== 1 && schemaVersion !== 2 || id === void 0 || version === void 0 || kind === void 0 || slug === void 0 || title === void 0 || description === void 0 || difficulty === void 0 || repository === void 0 || target === void 0 || allowedCommands === void 0 || hints === void 0 || solutionCommands === void 0 || root.actionRequirements !== void 0 && actionRequirements === void 0 || root.localizations !== void 0 && localizations === void 0) {
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
      ...parCommands !== void 0 ? { parCommands } : {},
      ...objectives ? { objectives } : {},
      initialRepository: repository,
      target,
      allowedCommands,
      hints,
      ...actionRequirements ? { actionRequirements } : {},
      ...localizations ? { localizations } : {},
      solutionCommands
    }
  };
}
function parseLocalizations(value, path, issues) {
  const source = record(value, path, issues);
  if (!source) return void 0;
  rejectUnknownKeys(source, [...LOCALES], path, issues);
  for (const locale of LOCALES) if (!Object.hasOwn(source, locale)) issue(issues, "schema.missing-localization", `Missing '${locale}' localization.`, `${path}.${locale}`);
  const result = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!isLocale(key)) continue;
    const localePath = `${path}.${key}`;
    const entry = record(raw, localePath, issues);
    if (!entry) continue;
    rejectUnknownKeys(entry, ["title", "description", "objectives", "hints", "commitMessages"], localePath, issues);
    const title = string(entry.title, `${localePath}.title`, issues);
    const description = string(entry.description, `${localePath}.description`, issues);
    const objectives = stringArray(entry.objectives, `${localePath}.objectives`, issues, false);
    const hints = stringArray(entry.hints, `${localePath}.hints`, issues, false);
    const commitMessages = stringRecord(entry.commitMessages, `${localePath}.commitMessages`, issues);
    if (title !== void 0 && description !== void 0 && objectives !== void 0 && hints !== void 0 && commitMessages !== void 0) {
      result[key] = { title, description, objectives, hints, commitMessages };
    }
  }
  return LOCALES.every((locale) => result[locale]) ? result : void 0;
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

// src/puzzles/rules.ts
function resolvePuzzleRules(puzzle) {
  if (puzzle.kind === "daily") {
    return {
      allowedCommands: SUPPORTED_ACTION_TYPES,
      target: { branch: "main", snapshot: puzzle.target.snapshot },
      actionRequirements: []
    };
  }
  return {
    allowedCommands: puzzle.allowedCommands,
    target: puzzle.target,
    actionRequirements: puzzle.actionRequirements ?? []
  };
}

// src/puzzles/completion.ts
function validatePuzzleCompletion(puzzle, repository, executed) {
  const rules = resolvePuzzleRules(puzzle);
  const base = validateRepository(repository, rules.target);
  const actions = executed.map((entry) => "action" in entry ? entry.action : entry);
  const unmet = [...base.unmet];
  const checks = [...base.checks];
  rules.actionRequirements.forEach((requirement, index) => {
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

// src/puzzles/par.ts
function deriveParCommands(puzzle, solutionCommands) {
  let repository = structuredClone(puzzle.initialRepository);
  const actions = [];
  let count = 0;
  for (const command of solutionCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) return void 0;
    const result = executeCommand(repository, command);
    if (!result.ok) return void 0;
    repository = result.repository;
    actions.push(result.action);
    if (result.action.type !== "log") count += 1;
    if (validatePuzzleCompletion(puzzle, repository, actions).solved) return count;
  }
  return void 0;
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
  validateHistoricalVisualStates(candidate.initialRepository, config.semantic, issues);
  if (issues.length > 0) return { ok: false, issues };
  validateDailyPolicy(candidate, issues);
  if (issues.length > 0) return { ok: false, issues };
  const initialValidation = validatePuzzleCompletion(candidate, candidate.initialRepository, []);
  if (initialValidation.solved) {
    add(issues, "target.initially-solved", "The initial repository already satisfies the target.", "$.initialRepository");
  } else {
    replaySolution(candidate, config.semantic, issues);
  }
  if (issues.length > 0) return { ok: false, issues };
  const { solutionCommands, ...puzzle } = candidate;
  const parCommands = candidate.kind === "daily" ? deriveParCommands(candidate, solutionCommands) : void 0;
  if (candidate.kind === "daily" && parCommands === void 0) {
    add(issues, "solution.no-winning-state", "The daily proof never reaches a winning state.", "$.solutionCommands");
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      puzzle: {
        ...puzzle,
        ...candidate.kind === "daily" ? {
          allowedCommands: [...resolvePuzzleRules(candidate).allowedCommands],
          target: { branch: "main", snapshot: candidate.target.snapshot },
          actionRequirements: void 0,
          parCommands
        } : {}
      },
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
function validateHistoricalVisualStates(repository, policy, issues) {
  for (const id of Object.keys(repository.commits)) {
    try {
      validatePolicyState(getSnapshot(repository, id), policy, `$.initialRepository.commits.${id}.snapshot`, issues);
    } catch {
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
  if (candidate.localizations) {
    const commitIds = Object.keys(candidate.initialRepository.commits).sort();
    for (const locale of ["en", "ca", "es"]) {
      const localized = candidate.localizations[locale];
      const path = `$.localizations.${locale}`;
      text(localized.title, limits.maxTitleLength, `${path}.title`, issues);
      text(localized.description, limits.maxDescriptionLength, `${path}.description`, issues);
      boundedStrings(localized.hints, limits.maxHints, limits.maxHintLength, `${path}.hints`, issues, "content.hints-too-large");
      boundedStrings(localized.objectives, limits.maxObjectives, limits.maxObjectiveLength, `${path}.objectives`, issues, "content.objectives-too-large");
      for (const [id, message] of Object.entries(localized.commitMessages)) text(message, limits.maxCommitMessageLength, `${path}.commitMessages.${id}`, issues);
      if (Object.keys(localized.commitMessages).sort().join("\0") !== commitIds.join("\0")) add(issues, "localization.commit-ids", "Localized commit messages must match the repository commit IDs exactly.", `${path}.commitMessages`);
      if (localized.objectives.length !== (candidate.objectives ?? []).length) add(issues, "localization.objective-count", "Localized objectives must preserve the canonical count.", `${path}.objectives`);
      if (localized.hints.length !== candidate.hints.length) add(issues, "localization.hint-count", "Localized hints must preserve the canonical count.", `${path}.hints`);
    }
  }
  boundedStrings(candidate.solutionCommands, limits.maxSolutionCommands, limits.maxSolutionCommandLength, "$.solutionCommands", issues, "content.solution-too-large");
}
function validateDailyPolicy(candidate, issues) {
  if (candidate.kind !== "daily") return;
  if (candidate.target.branch !== "main") add(issues, "daily.target-branch", "Daily puzzles must finish on main.", "$.target.branch");
  if (Object.keys(candidate.target.branchHeads ?? {}).length > 0) add(issues, "daily.branch-heads", "Daily puzzles cannot require branch positions.", "$.target.branchHeads");
  if ((candidate.target.requiredProvenance ?? []).length > 0) add(issues, "daily.provenance", "Daily puzzles cannot require history provenance.", "$.target.requiredProvenance");
  if ((candidate.actionRequirements ?? []).length > 0) add(issues, "daily.action-requirements", "Daily puzzles cannot require specific actions.", "$.actionRequirements");
  if (candidate.parCommands !== void 0 && (!Number.isInteger(candidate.parCommands) || candidate.parCommands < 0)) {
    add(issues, "daily.invalid-par", "parCommands must be a non-negative integer.", "$.parCommands");
  }
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
  validatePolicyState(snapshot, policy, path, issues);
}
function validatePolicyState(snapshot, policy, path, issues) {
  const reason = policy.validateState?.(snapshot);
  if (reason) add(issues, "semantic.incompatible-visual-state", reason, path);
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
function replaySolution(candidate, policy, issues) {
  let repository = cloneRepository(candidate.initialRepository);
  const actions = [];
  candidate.solutionCommands.forEach((command, index) => {
    const path = `$.solutionCommands[${index}]`;
    const parsed = parseGitCommand(command);
    if (!parsed.ok) {
      add(issues, "solution.parse-failed", parsed.error, path);
      return;
    }
    if (!resolvePuzzleRules(candidate).allowedCommands.includes(parsed.action.type)) {
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
    validatePolicyState(getSnapshot(repository, repository.head), policy, `$.solutionCommands[${index}]`, issues);
  });
  if (issues.some((item) => item.path.startsWith("$.solutionCommands"))) return;
  const validation = validatePuzzleCompletion(candidate, repository, actions);
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

// src/puzzles/solutionRoute.ts
function routeThroughFirstWin(puzzle, commands2) {
  let repository = cloneRepository(puzzle.initialRepository);
  const actions = [];
  for (const [index, command] of commands2.entries()) {
    const result = executeCommand(repository, command);
    if (!result.ok) return void 0;
    repository = result.repository;
    actions.push(result.action);
    if (validatePuzzleCompletion(puzzle, repository, actions).solved) return commands2.slice(0, index + 1);
  }
  return void 0;
}

// src/puzzles/generation/editorial.ts
var LOCALES2 = ["en", "ca", "es"];
var THEMES = {
  en: [
    { title: "Studio Day", subject: "studio portrait" },
    { title: "Festival Lights", subject: "festival display" },
    { title: "Garden Portrait", subject: "garden portrait" },
    { title: "The Big Premiere", subject: "premiere night portrait" },
    { title: "Colorful Postcard", subject: "art fair postcard" },
    { title: "The Workshop", subject: "makers' workshop display" },
    { title: "A Little Celebration", subject: "celebration keepsake" },
    { title: "Gallery Opening", subject: "gallery opening portrait" }
  ],
  ca: [
    { title: "Dia d'estudi", subject: "retrat d'estudi" },
    { title: "Llums de festa", subject: "muntatge de festa" },
    { title: "Retrat al jard\xED", subject: "retrat de jard\xED" },
    { title: "La gran estrena", subject: "retrat de nit d'estrena" },
    { title: "Postal acolorida", subject: "postal de fira d'art" },
    { title: "El taller", subject: "muntatge de taller creatiu" },
    { title: "Una petita celebraci\xF3", subject: "record de celebraci\xF3" },
    { title: "Obertura de la galeria", subject: "retrat d'obertura de galeria" }
  ],
  es: [
    { title: "D\xEDa de estudio", subject: "retrato de estudio" },
    { title: "Luces de festival", subject: "montaje de festival" },
    { title: "Retrato en el jard\xEDn", subject: "retrato de jard\xEDn" },
    { title: "El gran estreno", subject: "retrato de noche de estreno" },
    { title: "Postal colorida", subject: "postal de feria de arte" },
    { title: "El taller", subject: "montaje de taller creativo" },
    { title: "Una peque\xF1a celebraci\xF3n", subject: "recuerdo de celebraci\xF3n" },
    { title: "Apertura de la galer\xEDa", subject: "retrato de apertura de galer\xEDa" }
  ]
};
var PROPERTY_NAMES = {
  body: { en: "body", ca: "cos", es: "cuerpo" },
  sunglasses: { en: "sunglasses", ca: "ulleres de sol", es: "gafas de sol" },
  hat: { en: "hat", ca: "barret", es: "sombrero" },
  scarf: { en: "scarf", ca: "mocador", es: "pa\xF1uelo" },
  crest: { en: "crest", ca: "cresta", es: "cresta" },
  longLegs: { en: "long legs", ca: "cames llargues", es: "patas largas" }
};
var VALUE_NAMES = {
  none: { en: "none", ca: "cap", es: "ninguno" },
  cream: { en: "cream", ca: "crema", es: "crema" },
  black: { en: "black", ca: "negre", es: "negro" },
  red: { en: "red", ca: "vermell", es: "rojo" },
  blue: { en: "blue", ca: "blau", es: "azul" },
  turquoise: { en: "turquoise", ca: "turquesa", es: "turquesa" },
  purple: { en: "purple", ca: "porpra", es: "morado" },
  gold: { en: "gold", ca: "daurat", es: "dorado" },
  outline: { en: "outline", ca: "contorn", es: "contorno" }
};
var STRATEGY_HINTS = {
  dependency: {
    en: "Inspect the linked changes in order; a later change may depend on an earlier value.",
    ca: "Revisa els canvis relacionats per ordre; un canvi posterior pot dependre d'un valor anterior.",
    es: "Inspecciona los cambios relacionados en orden; un cambio posterior puede depender de un valor anterior."
  },
  "prepare-and-integrate": {
    en: "You can prepare work on another branch before integrating it; also check main for any unwanted change.",
    ca: "Pots preparar feina en una altra branca abans d'integrar-la; comprova tamb\xE9 si hi ha cap canvi no desitjat a main.",
    es: "Puedes preparar trabajo en otra rama antes de integrarlo; comprueba tambi\xE9n si hay alg\xFAn cambio no deseado en main."
  },
  "clean-room-integration": {
    en: "Useful work is bundled with temporary changes. Consider what a whole branch contributes, and what must be restored afterward.",
    ca: "La feina \xFAtil est\xE0 agrupada amb canvis temporals. Considera qu\xE8 aporta una branca sencera i qu\xE8 cal restaurar despr\xE9s.",
    es: "El trabajo \xFAtil est\xE1 agrupado con cambios temporales. Considera qu\xE9 aporta una rama entera y qu\xE9 debes restaurar despu\xE9s."
  }
};
var HINT_COPY = {
  en: {
    inspectCommit: (reference) => `Inspect the changes in commit ${reference} and compare them with the target.`,
    inspectBranch: (reference) => `Inspect the changes on branch ${reference} and compare them with the target.`,
    start: (commands2) => `One route starts with ${commands2}.`,
    next: (commands2) => `Next: ${commands2}.`,
    then: ", then ",
    on: (branch, facts) => `On ${branch}: ${facts}.`,
    last: "One last step finishes the route.",
    needs: (branch, facts) => `${branch} still needs: ${facts}.`
  },
  ca: {
    inspectCommit: (reference) => `Revisa els canvis del commit ${reference} i compara'ls amb l'objectiu.`,
    inspectBranch: (reference) => `Revisa els canvis de la branca ${reference} i compara'ls amb l'objectiu.`,
    start: (commands2) => `Una ruta comen\xE7a amb ${commands2}.`,
    next: (commands2) => `Despr\xE9s: ${commands2}.`,
    then: ", despr\xE9s ",
    on: (branch, facts) => `A ${branch}: ${facts}.`,
    last: "Un \xFAltim pas acaba la ruta.",
    needs: (branch, facts) => `A ${branch} encara li falta: ${facts}.`
  },
  es: {
    inspectCommit: (reference) => `Inspecciona los cambios del commit ${reference} y comp\xE1ralos con el objetivo.`,
    inspectBranch: (reference) => `Inspecciona los cambios de la rama ${reference} y comp\xE1ralos con el objetivo.`,
    start: (commands2) => `Una ruta empieza con ${commands2}.`,
    next: (commands2) => `Despu\xE9s: ${commands2}.`,
    then: ", despu\xE9s ",
    on: (branch, facts) => `En ${branch}: ${facts}.`,
    last: "Un \xFAltimo paso termina la ruta.",
    needs: (branch, facts) => `A ${branch} a\xFAn le falta: ${facts}.`
  }
};
function createTemplateLocalizations(candidate, family, seed) {
  const themeIndex = hash(`${family}|${seed}`) % THEMES.en.length;
  const hints = createHints(candidate, family);
  const empty = (locale) => ({
    en: "the repository's existing work",
    ca: "la feina que ja hi ha al repositori",
    es: "el trabajo existente del repositorio"
  })[locale];
  const title = (locale) => THEMES[locale][themeIndex].title;
  const description = (locale) => ({
    en: `The ${THEMES.en[themeIndex].subject} is being prepared. Use the illustrated target as your reference while reviewing ${empty("en")}.`,
    ca: `Preparem el ${THEMES.ca[themeIndex].subject} amb un \xFAltim retoc. Fes servir la il\xB7lustraci\xF3 objectiu com a refer\xE8ncia mentre revises ${empty("ca")}.`,
    es: `Preparamos el ${THEMES.es[themeIndex].subject} con un \xFAltimo retoque. Usa la ilustraci\xF3n objetivo como referencia mientras revisas ${empty("es")}.`
  })[locale];
  const objectives = (locale) => ({
    en: ["Make main match the illustrated target."],
    ca: ["Fes que main coincideixi amb la il\xB7lustraci\xF3 objectiu."],
    es: ["Haz que main coincida con la ilustraci\xF3n objetivo."]
  })[locale];
  const commitMessages = (locale) => Object.fromEntries(Object.entries(candidate.initialRepository.commits).map(([id, commit]) => {
    if (commit.changes.length === 0) {
      return [id, { en: "Start the repository", ca: "Inicia el repositori", es: "Inicia el repositorio" }[locale]];
    }
    const facts = commit.changes.map((change) => {
      const property = PROPERTY_NAMES[change.property]?.[locale] ?? change.property;
      const from = VALUE_NAMES[String(change.from)]?.[locale] ?? String(change.from);
      const to = VALUE_NAMES[String(change.to)]?.[locale] ?? String(change.to);
      return { en: `set ${property} from ${from} to ${to}`, ca: `canvia ${property} de ${from} a ${to}`, es: `cambia ${property} de ${from} a ${to}` }[locale];
    });
    return [id, { en: facts.join("; "), ca: facts.join("; "), es: facts.join("; ") }[locale]];
  }));
  const build = (locale) => ({
    title: title(locale),
    description: description(locale),
    objectives: objectives(locale),
    hints: hints[locale],
    commitMessages: commitMessages(locale)
  });
  return { en: build("en"), ca: build("ca"), es: build("es") };
}
function refreshTemplateHints(candidate, family) {
  const hints = createHints(candidate, family);
  const localizations = candidate.localizations && Object.fromEntries(LOCALES2.map((locale) => [locale, { ...candidate.localizations[locale], hints: hints[locale] }]));
  return { ...candidate, hints: hints.en, ...localizations ? { localizations } : {} };
}
function applyStoryText(candidate, input) {
  if (!plainRecord(input) || !exactKeys(input, LOCALES2)) return void 0;
  const localizedText = {};
  for (const locale of LOCALES2) {
    const entry = input[locale];
    if (!plainRecord(entry) || !exactKeys(entry, ["title", "description"])) return void 0;
    if (!safeStoryString(entry.title, DEFAULT_PUZZLE_LIMITS.maxTitleLength) || !safeStoryString(entry.description, DEFAULT_PUZZLE_LIMITS.maxDescriptionLength)) return void 0;
    localizedText[locale] = { title: entry.title, description: entry.description };
  }
  const localizations = candidate.localizations ? structuredClone(candidate.localizations) : createTemplateLocalizations(candidate, "daily", candidate.id);
  for (const locale of LOCALES2) {
    localizations[locale] = { ...localizations[locale], ...localizedText[locale] };
  }
  const english = localizedText.en;
  return { ...candidate, title: english.title, description: english.description, localizations };
}
function safeStoryString(value, maximum) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value) && !/(?:https?:\/\/|www\.|<\/?[a-z][^>]*>|```|`|\b(?:git|cherry-pick|revert|rebase|merge|checkout|switch|branch|commit)\b|\b[A-Za-z][A-Za-z0-9_-]{0,47}\b\s*(?:;|&&|\|))/i.test(value) && !/[<>`{}[\]\\]/.test(value);
}
function createHints(candidate, family) {
  const route = traceRoute(candidate);
  let shown = route.length;
  while (shown > 0 && route[shown - 1].setup) shown -= 1;
  shown = Math.max(0, shown - 1);
  const strategy = STRATEGY_HINTS[getHintStyle(candidate, family)];
  const reference = firstReference(candidate);
  const reservedHints = (strategy ? 1 : 0) + (reference ? 1 : 0) + 1;
  const steps = groupRouteSteps(route.slice(0, shown), DEFAULT_PUZZLE_LIMITS.maxHints - reservedHints);
  const lastShownState = steps.at(-1)?.at(-1)?.targetBranchState ?? getSnapshot(candidate.initialRepository, candidate.initialRepository.branches[candidate.target.branch]);
  const remaining = diffSnapshots(lastShownState, candidate.target.snapshot).filter((change) => change.to !== void 0);
  return Object.fromEntries(LOCALES2.map((locale) => {
    const copy = HINT_COPY[locale];
    const inspect = reference && (reference.kind === "commit" ? copy.inspectCommit(reference.id) : copy.inspectBranch(reference.id));
    const finish = remaining.length > 0 ? `${copy.last} ${copy.needs(candidate.target.branch, describeChanges(remaining, locale))}` : copy.last;
    return [locale, [
      ...strategy ? [strategy[locale]] : [],
      ...inspect ? [inspect] : [],
      ...steps.map((step, index) => describeRouteStep(step, index, locale)),
      withinHintLimit(finish, copy.last)
    ]];
  }));
}
function traceRoute(candidate) {
  let repository = cloneRepository(candidate.initialRepository);
  const commands2 = routeThroughFirstWin(candidate, candidate.solutionCommands) ?? candidate.solutionCommands;
  return commands2.map((command) => {
    const branch = repository.currentBranch;
    const result = executeCommand(repository, command);
    const changes = result.ok ? diffSnapshots(getSnapshot(repository, repository.branches[branch]), getSnapshot(result.repository, result.repository.branches[branch])) : [];
    if (result.ok) repository = result.repository;
    const parsed = parseGitCommand(command);
    return {
      command,
      branch,
      changes,
      setup: parsed.ok && (parsed.action.type === "switch" || parsed.action.type === "log"),
      targetBranchState: getSnapshot(repository, repository.branches[candidate.target.branch])
    };
  });
}
function firstReference(candidate) {
  const parsed = candidate.solutionCommands[0] ? parseGitCommand(candidate.solutionCommands[0]) : void 0;
  if (!parsed?.ok) return void 0;
  const { action } = parsed;
  if (action.type === "cherry-pick" || action.type === "revert") return { kind: "commit", id: action.commit };
  if (action.type === "switch" || action.type === "merge") return { kind: "branch", id: action.branch };
  if (action.type === "rebase" || action.type === "interactive-rebase") return { kind: "branch", id: action.onto };
  return void 0;
}
function groupRouteSteps(route, maxSteps) {
  const steps = [];
  for (const item of route) {
    const previous = steps.at(-1);
    if (previous?.at(-1)?.setup) previous.push(item);
    else steps.push([item]);
  }
  while (steps.length > maxSteps) {
    let smallest = 0;
    for (let index = 1; index < steps.length - 1; index += 1) {
      if (steps[index].length + steps[index + 1].length < steps[smallest].length + steps[smallest + 1].length) smallest = index;
    }
    steps.splice(smallest, 2, [...steps[smallest], ...steps[smallest + 1]]);
  }
  return steps;
}
function describeRouteStep(step, index, locale) {
  const copy = HINT_COPY[locale];
  const commands2 = step.map(({ command }) => formatRouteCommand(command)).join(copy.then);
  const sentence = index === 0 ? copy.start(commands2) : copy.next(commands2);
  const byBranch = /* @__PURE__ */ new Map();
  for (const { branch, changes } of step) {
    const net = byBranch.get(branch) ?? /* @__PURE__ */ new Map();
    for (const change of changes) net.set(change.property, change);
    byBranch.set(branch, net);
  }
  const effects = [...byBranch].filter(([, net]) => net.size > 0).map(([branch, net]) => copy.on(branch, describeChanges([...net.values()], locale)));
  return withinHintLimit([sentence, ...effects].join(" "), sentence);
}
function describeChanges(changes, locale) {
  return changes.slice(0, 3).map(({ property, to }) => {
    const name = PROPERTY_NAMES[property]?.[locale] ?? property;
    return `${name} \u2192 ${VALUE_NAMES[String(to)]?.[locale] ?? String(to)}`;
  }).join(", ");
}
function formatRouteCommand(command) {
  const [first, ...todo] = command.split("\n");
  return todo.length > 0 ? `${first} (${todo.join(", ")})` : first;
}
function withinHintLimit(text2, fallback) {
  return text2.length <= DEFAULT_PUZZLE_LIMITS.maxHintLength ? text2 : fallback;
}
function getHintStyle(candidate, family) {
  if (family === "clean-room-integration") return "clean-room-integration";
  const normalizedFamily = family.toLowerCase();
  if (normalizedFamily.includes("prepare-and-integrate") || normalizedFamily.includes("prepare-integration")) return "prepare-and-integrate";
  if (normalizedFamily.includes("bundled")) return "bundle";
  const hasRevert = candidate.solutionCommands.some((command) => {
    const parsed = parseGitCommand(command);
    return parsed.ok && parsed.action.type === "revert";
  });
  if (normalizedFamily.includes("repair") || hasRevert) return "repair";
  if (normalizedFamily.includes("dependency")) return "dependency";
  const pickedIds = candidate.solutionCommands.flatMap((command) => {
    const parsed = parseGitCommand(command);
    return parsed.ok && parsed.action.type === "cherry-pick" ? [parsed.action.commit] : [];
  });
  const commits = candidate.initialRepository.commits;
  const hasDependency = pickedIds.some((id) => pickedIds.some((other) => other !== id && isAncestor3(other, id, commits)));
  return hasDependency ? "dependency" : "bundle";
}
function isAncestor3(ancestor, descendant, commits) {
  const pending = [...commits[descendant]?.parents ?? []];
  const visited = /* @__PURE__ */ new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === ancestor) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...commits[current]?.parents ?? []);
  }
  return false;
}
function plainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}
function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0) % THEMES.en.length;
}

// src/puzzles/generation/novelty.ts
function fingerprintMechanics(repository, target) {
  const nodes = [];
  const add3 = (color) => (nodes.push({ color, edges: [] }), nodes.length - 1);
  const link = (from, label, to) => nodes[from].edges.push({ label, to });
  const commitIds = Object.keys(repository.commits);
  const commits = /* @__PURE__ */ new Map();
  for (const id of commitIds) commits.set(id, add3("commit"));
  const stateNodes = /* @__PURE__ */ new Map();
  const branchNodes = /* @__PURE__ */ new Map();
  const propertyNodes = /* @__PURE__ */ new Map();
  const valueNodes = /* @__PURE__ */ new Map();
  const state = (name, data, color) => {
    const root = add3(color);
    for (const [property, value] of Object.entries(data)) {
      const prop = getProperty(property);
      const val = getValue(property, value);
      const entry = add3("state-entry");
      link(root, "entry", entry);
      link(entry, "property", prop);
      link(entry, "value", val);
    }
    stateNodes.set(name, root);
    return root;
  };
  const getProperty = (key) => {
    let id = propertyNodes.get(key);
    if (id === void 0) {
      id = add3("property");
      propertyNodes.set(key, id);
    }
    return id;
  };
  const valueKey = (property, value) => `${property}\0${stable(value)}`;
  const getValue = (property, value) => {
    const key = valueKey(property, value);
    let id = valueNodes.get(key);
    if (id === void 0) {
      id = add3("value");
      valueNodes.set(key, id);
    }
    return id;
  };
  state("initial", repository.initialState, "initial-state");
  state("target", target.snapshot, "target-state");
  let changeCount = 0;
  let bundleCount = 0;
  let parentCount = 0;
  for (const id of commitIds) {
    const commit = repository.commits[id];
    const cnode = commits.get(id);
    commit.parents.forEach((parent, index) => {
      const p = commits.get(parent);
      if (p !== void 0) {
        link(cnode, `parent:${index}`, p);
        parentCount++;
      }
    });
    if (commit.changes.length > 1) bundleCount++;
    for (const change of commit.changes) {
      const event = add3("change");
      link(cnode, "change", event);
      link(event, "property", getProperty(change.property));
      link(event, "from", getValue(change.property, change.from));
      link(event, "to", getValue(change.property, change.to));
      changeCount++;
    }
  }
  const mainHead = repository.branches.main;
  for (const [name, commit] of repository.branches ? Object.entries(repository.branches) : []) {
    const branch = add3(name === "main" ? name === repository.currentBranch ? "branch:main-current" : "branch:main" : name === repository.currentBranch ? "branch:current" : "branch:other");
    branchNodes.set(name, branch);
    const c = commits.get(commit);
    if (c !== void 0) link(branch, "points-to", c);
  }
  const head = commits.get(repository.head);
  if (head !== void 0) nodes[head].color += "|head";
  const targetBranchNode = branchNodes.get(target.branch);
  if (targetBranchNode !== void 0) link(stateNodes.get("target"), "target-branch", targetBranchNode);
  const mainNode = commits.get(mainHead);
  if (mainNode !== void 0) nodes[mainNode].color += "|main-branch-head";
  const currentHead = commits.get(repository.branches[repository.currentBranch]);
  if (currentHead !== void 0) nodes[currentHead].color += "|current-branch-head";
  let colors = nodes.map((node) => node.color);
  for (let round = 0; round <= nodes.length; round++) {
    const signatures = nodes.map((node, index) => stable({ self: colors[index], adjacent: node.edges.map((edge) => [edge.label, colors[edge.to]]).sort((a, b) => stable(a).localeCompare(stable(b))) }));
    const palette = [...new Set(signatures)].sort();
    const next = signatures.map((signature) => `c${palette.indexOf(signature)}`);
    if (next.every((value, index) => value === colors[index])) break;
    colors = next;
  }
  const edgeCounts = /* @__PURE__ */ new Map();
  nodes.forEach((node, from) => node.edges.forEach((edge) => {
    const key = stable([colors[from], edge.label, colors[edge.to]]);
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }));
  const canonical = stable({ nodes: countColors(colors), edges: [...edgeCounts].sort(([a], [b]) => a.localeCompare(b)), rounds: nodes.length });
  return { canonical, summary: { commits: commitIds.length, branches: Object.keys(repository.branches).length, properties: propertyNodes.size, changes: changeCount, parents: parentCount, bundles: bundleCount } };
}
function countColors(colors) {
  const counts = /* @__PURE__ */ new Map();
  for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}
function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

// src/puzzles/generation/decisionCore.ts
function fingerprintDecisionCore(candidate) {
  const initial = candidate.initialRepository;
  const usedBranches = /* @__PURE__ */ new Set(["main", initial.currentBranch]);
  const originalIds = /* @__PURE__ */ new Set();
  const includeHistory = (repository2, start2) => {
    const pending = [start2], seen = /* @__PURE__ */ new Set();
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const commit = repository2.commits[id];
      if (!commit) throw new Error("Proof references missing history.");
      if (initial.commits[id]) originalIds.add(id);
      pending.push(...commit.parents, ...commit.provenance?.sourceCommits ?? []);
    }
  };
  let repository = initial;
  includeHistory(repository, repository.head);
  for (const command of candidate.solutionCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) throw new Error("Invalid proof command.");
    const action = parsed.action;
    if (action.type === "switch" || action.type === "merge") {
      usedBranches.add(action.branch);
      includeHistory(repository, repository.branches[action.branch]);
    } else if (action.type === "rebase" || action.type === "interactive-rebase") {
      usedBranches.add(action.onto);
      includeHistory(repository, repository.branches[action.onto]);
    } else if (action.type === "cherry-pick" || action.type === "revert") {
      includeHistory(repository, action.commit);
    }
    const step = executeCommand(repository, command);
    if (!step.ok) throw new Error("Invalid proof transition.");
    repository = step.repository;
  }
  const start = getSnapshot(initial, initial.branches.main);
  const relevant = new Set(Object.keys(candidate.target.snapshot).filter((property) => JSON.stringify(start[property]) !== JSON.stringify(candidate.target.snapshot[property])));
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of originalIds) {
      const changes = initial.commits[id].changes;
      if (!changes.some((change) => relevant.has(change.property))) continue;
      for (const change of changes) if (!relevant.has(change.property)) {
        relevant.add(change.property);
        grew = true;
      }
    }
  }
  const commits = Object.fromEntries([...originalIds].map((id) => [id, {
    ...initial.commits[id],
    changes: initial.commits[id].changes.filter((change) => relevant.has(change.property))
  }]));
  const resolve = (id) => {
    const commit = commits[id];
    if (!commit) throw new Error("Incomplete decision core.");
    return !commit.changes.length && commit.parents.length === 1 ? resolve(commit.parents[0]) : id;
  };
  const kept = Object.fromEntries(Object.entries(commits).filter(([id]) => resolve(id) === id).map(([id, commit]) => [id, { ...commit, parents: commit.parents.map(resolve) }]));
  const branches = Object.fromEntries([...usedBranches].map((branch) => [branch, resolve(initial.branches[branch])]));
  const restrict = (state) => Object.fromEntries(Object.entries(state).filter(([property]) => relevant.has(property)));
  return fingerprintMechanics(
    { ...initial, commits: kept, branches, head: resolve(initial.head), initialState: restrict(initial.initialState) },
    { branch: "main", snapshot: restrict(candidate.target.snapshot) }
  ).canonical;
}

// src/puzzles/generation/mechanicsState.ts
function snapshotKey(state) {
  return JSON.stringify(Object.entries(state).sort(([a], [b]) => a.localeCompare(b)));
}

// src/puzzles/generation/proceduralQuality.ts
function findCopyOnlySolution(candidate, maxDepth = candidate.solutionCommands.length) {
  if (candidate.kind !== "daily" || candidate.initialRepository.currentBranch !== "main") throw new Error("Expected a daily starting on main.");
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 20) throw new Error("Invalid copy-only search depth.");
  const commands2 = Object.keys(candidate.initialRepository.commits).sort().map((id) => `git cherry-pick ${id}`);
  let frontier = [{ repository: candidate.initialRepository, path: [] }];
  const seen = /* @__PURE__ */ new Set([snapshotKey(getSnapshot(candidate.initialRepository))]);
  if (validatePuzzleCompletion(candidate, candidate.initialRepository, []).solved) return [];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const node of frontier) for (const command of commands2) {
      const step = executeCommand(node.repository, command);
      if (!step.ok || !step.mutated) continue;
      const path = [...node.path, command];
      if (validatePuzzleCompletion(candidate, step.repository, []).solved) return path;
      const key = snapshotKey(getSnapshot(step.repository));
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ repository: step.repository, path });
    }
    frontier = next;
    if (!frontier.length) return void 0;
  }
  return void 0;
}
function solutionCommandPattern(candidate) {
  return candidate.solutionCommands.map((command) => {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) throw new Error("Invalid proof command.");
    return parsed.action.type === "interactive-rebase" && parsed.action.todo?.some((item) => item.action === "squash") ? "squash" : parsed.action.type;
  }).join(" \u2192 ");
}
function proofHasSequentialCopies(candidate) {
  let repository = candidate.initialRepository;
  let previousPick;
  for (const command of candidate.solutionCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) throw new Error("Invalid proof command.");
    if (parsed.action.type === "cherry-pick" && previousPick && isAncestor(repository, previousPick, parsed.action.commit)) return true;
    previousPick = parsed.action.type === "cherry-pick" ? parsed.action.commit : void 0;
    const step = executeCommand(repository, command);
    if (!step.ok) throw new Error("Invalid proof transition.");
    repository = step.repository;
  }
  return false;
}

// src/puzzles/generation/candidateArtifact.ts
var MINIMUM_COMMANDS = { easy: 2, medium: 4, hard: 6 };
var MAXIMUM_PROOF_COMMANDS = { easy: 2, medium: 4, hard: 10 };
var FINGERPRINT = /^[a-f0-9]{64}$/;
async function verifyCandidateArtifact(value, trusted) {
  validateCertificateInputs(trusted?.sourceFingerprint, 0);
  if (!isRecord2(value) || value.formatVersion !== 1 || typeof value.id !== "string" || !isRecord2(value.candidate) || !isRecord2(value.certificate) || !isRecord2(value.novelty)) {
    throw new Error("Malformed candidate artifact.");
  }
  const artifact = value;
  const { candidate, certificate } = artifact;
  validateCertificateInputs(certificate.sourceFingerprint, certificate.excludedThroughDepth);
  if (certificate.sourceFingerprint !== trusted.sourceFingerprint) throw new Error("Candidate artifact source fingerprint is not trusted.");
  if (certificate.evaluatorVersion !== 1 || !Number.isInteger(certificate.minimumCommands) || !Number.isInteger(certificate.proofCommands)) throw new Error("Malformed candidate certificate metadata.");
  const validated = validateCandidate(candidate);
  const minimumCommands = MINIMUM_COMMANDS[candidate.difficulty];
  if (certificate.minimumCommands !== minimumCommands || certificate.excludedThroughDepth < minimumCommands - 1 || certificate.excludedThroughDepth >= candidate.solutionCommands.length || certificate.proofCommands !== candidate.solutionCommands.length || candidate.solutionCommands.length < minimumCommands || candidate.solutionCommands.length > MAXIMUM_PROOF_COMMANDS[candidate.difficulty] || validated.value.puzzle.parCommands !== candidate.solutionCommands.length) {
    throw new Error("Candidate artifact certificate does not match its proof or difficulty.");
  }
  if (certificate.copyOnlyExcludedThroughDepth !== (candidate.difficulty === "easy" ? 0 : candidate.solutionCommands.length)) throw new Error("Missing offline copy-only exclusion.");
  verifyStrategicAndCopyPolicy(candidate, candidate.solutionCommands.length, false);
  const mechanicsDigest = await sha256(canonicalJson(mechanicsProjection(candidate)));
  if (artifact.id !== mechanicsDigest || certificate.mechanicsDigest !== mechanicsDigest) throw new Error("Candidate artifact mechanics digest mismatch.");
  const novelty = await makeNovelty(candidate);
  if (!isRecord2(artifact.novelty) || artifact.novelty.mechanicsHash !== novelty.mechanicsHash || artifact.novelty.decisionCoreHash !== novelty.decisionCoreHash || artifact.novelty.commandPattern !== novelty.commandPattern) {
    throw new Error("Candidate artifact novelty metadata mismatch.");
  }
  return artifact;
}
function canonicalJson(value) {
  return JSON.stringify(sortRecursively(value));
}
async function makeNovelty(candidate) {
  const mechanics = fingerprintMechanics(candidate.initialRepository, candidate.target).canonical;
  const core = fingerprintDecisionCore(candidate);
  return {
    mechanicsHash: await sha256(mechanics),
    decisionCoreHash: await sha256(core),
    commandPattern: solutionCommandPattern(candidate)
  };
}
function mechanicsProjection(candidate) {
  const commits = Object.fromEntries(Object.entries(candidate.initialRepository.commits).map(([id, commit]) => {
    const { message: _excludedMessage, ...mechanics } = commit;
    return [id, mechanics];
  }));
  return {
    schemaVersion: candidate.schemaVersion,
    themeId: candidate.themeId,
    difficulty: candidate.difficulty,
    initialRepository: { ...candidate.initialRepository, commits },
    target: candidate.target,
    allowedCommands: candidate.allowedCommands,
    solutionCommands: candidate.solutionCommands
  };
}
function validateCandidate(candidate) {
  if (!candidate || candidate.kind !== "daily" || !candidate.solutionCommands || !Array.isArray(candidate.solutionCommands)) {
    throw new Error("Artifact candidate must be a daily puzzle with a private proof.");
  }
  const result = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!result.ok) throw new Error(`Candidate failed normal puzzle validation: ${result.issues.map((issue2) => issue2.code).join(", ")}`);
  return result;
}
function verifyStrategicAndCopyPolicy(candidate, minimumCommands, search) {
  if (candidate.difficulty === "easy") return;
  if (!solutionCommandPattern(candidate).split(" \u2192 ").some((type) => ["merge", "rebase", "interactive-rebase", "squash"].includes(type))) throw new Error("Medium and hard candidates need an integration or rebase proof.");
  if (proofHasSequentialCopies(candidate)) throw new Error("Candidate proof repeats predecessor cherry-picks.");
  const copyOnly = search ? findCopyOnlySolution(candidate, minimumCommands) : void 0;
  if (copyOnly && copyOnly.length <= minimumCommands) throw new Error("Candidate has an equally short copy-only solution.");
}
function validateCertificateInputs(sourceFingerprint, excludedThroughDepth) {
  if (typeof sourceFingerprint !== "string" || !FINGERPRINT.test(sourceFingerprint)) throw new Error("Invalid candidate source fingerprint.");
  if (!Number.isInteger(excludedThroughDepth) || excludedThroughDepth < 0) throw new Error("Invalid certified search depth.");
}
function sortRecursively(value) {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortRecursively(value[key])]));
  }
  return value;
}
async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function isRecord2(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// src/puzzles/generation/proceduralPublication.ts
async function publishProceduralDaily(date, dependencies) {
  if (!isDate(date)) throw new Error("date must be a valid YYYY-MM-DD date.");
  const { store } = dependencies;
  const existing = await store.published(date);
  if (existing) return { status: "already-published", ...existing };
  const reservation = await store.reserve({ date, difficulty: dependencies.chooseDifficulty(), sourceFingerprint: dependencies.sourceFingerprint });
  if (reservation.date !== date) throw new Error("Reservation date does not match the requested daily.");
  if (reservation.publishedId) return { status: "already-published", id: reservation.publishedId, difficulty: reservation.difficulty };
  if (!reservation.artifact) return { status: "awaiting-candidate", date, difficulty: reservation.difficulty };
  const artifact = await verifyCandidateArtifact(reservation.artifact, { sourceFingerprint: dependencies.sourceFingerprint });
  if (artifact.candidate.difficulty !== reservation.difficulty) throw new Error("Reserved artifact difficulty does not match the persisted daily difficulty.");
  const candidate = refreshTemplateHints({
    ...structuredClone(artifact.candidate),
    id: `daily-${date}`,
    slug: `daily-${date}`,
    publishedOn: date,
    version: 1
  }, "procedural");
  const runId = await store.startRun({
    date,
    difficulty: reservation.difficulty,
    candidateId: artifact.id,
    certificate: structuredClone(artifact.certificate),
    novelty: structuredClone(artifact.novelty)
  });
  try {
    let publishCandidate = candidate;
    let storySource = "template";
    let storyFailure;
    if (dependencies.story) {
      try {
        const story = await dependencies.story({ theme: candidate.title, target: structuredClone(candidate.target.snapshot) });
        const edited = applyStoryText(candidate, story);
        if (edited) {
          publishCandidate = edited;
          storySource = "ai";
        } else storyFailure = "story-invalid";
      } catch {
        storyFailure = "story-unavailable";
      }
    }
    await store.recordStory(runId, storySource, storyFailure);
    const validated = validatePuzzleCandidate(publishCandidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    if (!validated.ok) throw new Error("Final procedural daily validation failed.");
    const id = await store.publish(runId, validated.value);
    return { status: "published", id, difficulty: reservation.difficulty, source: "procedural", storySource };
  } catch (error) {
    await store.failed(runId, "publication-failed");
    throw error;
  }
}
function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && (/* @__PURE__ */ new Date(`${value}T00:00:00Z`)).toISOString().slice(0, 10) === value;
}

// src/puzzles/generation/proceduralManifest.json
var proceduralManifest_default = {
  formatVersion: 1,
  evaluatorVersion: 1,
  sourceFingerprint: "bb0c37554bbfed2604c81d64cc7c5d95a99d080db485b81c60a7c8108ab4036b"
};
export {
  CHICKEN_V2_SEMANTIC_POLICY,
  proceduralManifest_default as PROCEDURAL_CERTIFICATION,
  createGenerationBrief,
  createGuidedBrief,
  normalizeGuidedGoal,
  publishProceduralDaily,
  toGuidedPuzzle,
  validateCandidateAgainstBrief,
  validatePuzzleCandidate,
  verifyCandidateArtifact
};
