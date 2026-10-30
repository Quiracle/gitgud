import { DEFAULT_PUZZLE_LIMITS } from "../policy";
import { cloneRepository, diffSnapshots, executeCommand, getSnapshot, parseGitCommand } from "../../engine";
import type { SemanticChange, SemanticState } from "../../engine";
import { routeThroughFirstWin } from "../solutionRoute";
import type { PuzzleCandidate, PuzzleLocalization, PuzzleLocalizations } from "../types";

const LOCALES = ["en", "ca", "es"] as const;
type Locale = typeof LOCALES[number];

const THEMES: Record<Locale, readonly { title: string; subject: string }[]> = {
  en: [
    { title: "Studio Day", subject: "studio portrait" },
    { title: "Festival Lights", subject: "festival display" },
    { title: "Garden Portrait", subject: "garden portrait" },
    { title: "The Big Premiere", subject: "premiere night portrait" },
    { title: "Colorful Postcard", subject: "art fair postcard" },
    { title: "The Workshop", subject: "makers' workshop display" },
    { title: "A Little Celebration", subject: "celebration keepsake" },
    { title: "Gallery Opening", subject: "gallery opening portrait" },
  ],
  ca: [
    { title: "Dia d'estudi", subject: "retrat d'estudi" },
    { title: "Llums de festa", subject: "muntatge de festa" },
    { title: "Retrat al jardí", subject: "retrat de jardí" },
    { title: "La gran estrena", subject: "retrat de nit d'estrena" },
    { title: "Postal acolorida", subject: "postal de fira d'art" },
    { title: "El taller", subject: "muntatge de taller creatiu" },
    { title: "Una petita celebració", subject: "record de celebració" },
    { title: "Obertura de la galeria", subject: "retrat d'obertura de galeria" },
  ],
  es: [
    { title: "Día de estudio", subject: "retrato de estudio" },
    { title: "Luces de festival", subject: "montaje de festival" },
    { title: "Retrato en el jardín", subject: "retrato de jardín" },
    { title: "El gran estreno", subject: "retrato de noche de estreno" },
    { title: "Postal colorida", subject: "postal de feria de arte" },
    { title: "El taller", subject: "montaje de taller creativo" },
    { title: "Una pequeña celebración", subject: "recuerdo de celebración" },
    { title: "Apertura de la galería", subject: "retrato de apertura de galería" },
  ],
};

const PROPERTY_NAMES: Record<string, Record<Locale, string>> = {
  body: { en: "body", ca: "cos", es: "cuerpo" },
  sunglasses: { en: "sunglasses", ca: "ulleres de sol", es: "gafas de sol" },
  hat: { en: "hat", ca: "barret", es: "sombrero" },
  scarf: { en: "scarf", ca: "mocador", es: "pañuelo" },
  crest: { en: "crest", ca: "cresta", es: "cresta" },
  longLegs: { en: "long legs", ca: "cames llargues", es: "patas largas" },
};
const VALUE_NAMES: Record<string, Record<Locale, string>> = {
  none: { en: "none", ca: "cap", es: "ninguno" },
  cream: { en: "cream", ca: "crema", es: "crema" },
  black: { en: "black", ca: "negre", es: "negro" },
  red: { en: "red", ca: "vermell", es: "rojo" },
  blue: { en: "blue", ca: "blau", es: "azul" },
  turquoise: { en: "turquoise", ca: "turquesa", es: "turquesa" },
  purple: { en: "purple", ca: "porpra", es: "morado" },
  gold: { en: "gold", ca: "daurat", es: "dorado" },
  outline: { en: "outline", ca: "contorn", es: "contorno" },
};

/** Guidance that names a real strategy. Anything amounting to "compare main with the target" stays out. */
const STRATEGY_HINTS: Partial<Record<HintStyle, Record<Locale, string>>> = {
  dependency: {
    en: "Inspect the linked changes in order; a later change may depend on an earlier value.",
    ca: "Revisa els canvis relacionats per ordre; un canvi posterior pot dependre d'un valor anterior.",
    es: "Inspecciona los cambios relacionados en orden; un cambio posterior puede depender de un valor anterior.",
  },
  "prepare-and-integrate": {
    en: "You can prepare work on another branch before integrating it; also check main for any unwanted change.",
    ca: "Pots preparar feina en una altra branca abans d'integrar-la; comprova també si hi ha cap canvi no desitjat a main.",
    es: "Puedes preparar trabajo en otra rama antes de integrarlo; comprueba también si hay algún cambio no deseado en main.",
  },
  "clean-room-integration": {
    en: "Useful work is bundled with temporary changes. Consider what a whole branch contributes, and what must be restored afterward.",
    ca: "La feina útil està agrupada amb canvis temporals. Considera què aporta una branca sencera i què cal restaurar després.",
    es: "El trabajo útil está agrupado con cambios temporales. Considera qué aporta una rama entera y qué debes restaurar después.",
  },
};

const HINT_COPY: Record<Locale, {
  inspectCommit: (reference: string) => string;
  inspectBranch: (reference: string) => string;
  start: (commands: string) => string;
  next: (commands: string) => string;
  then: string;
  on: (branch: string, facts: string) => string;
  last: string;
  needs: (branch: string, facts: string) => string;
}> = {
  en: {
    inspectCommit: (reference) => `Inspect the changes in commit ${reference} and compare them with the target.`,
    inspectBranch: (reference) => `Inspect the changes on branch ${reference} and compare them with the target.`,
    start: (commands) => `One route starts with ${commands}.`,
    next: (commands) => `Next: ${commands}.`,
    then: ", then ",
    on: (branch, facts) => `On ${branch}: ${facts}.`,
    last: "One last step finishes the route.",
    needs: (branch, facts) => `${branch} still needs: ${facts}.`,
  },
  ca: {
    inspectCommit: (reference) => `Revisa els canvis del commit ${reference} i compara'ls amb l'objectiu.`,
    inspectBranch: (reference) => `Revisa els canvis de la branca ${reference} i compara'ls amb l'objectiu.`,
    start: (commands) => `Una ruta comença amb ${commands}.`,
    next: (commands) => `Després: ${commands}.`,
    then: ", després ",
    on: (branch, facts) => `A ${branch}: ${facts}.`,
    last: "Un últim pas acaba la ruta.",
    needs: (branch, facts) => `A ${branch} encara li falta: ${facts}.`,
  },
  es: {
    inspectCommit: (reference) => `Inspecciona los cambios del commit ${reference} y compáralos con el objetivo.`,
    inspectBranch: (reference) => `Inspecciona los cambios de la rama ${reference} y compáralos con el objetivo.`,
    start: (commands) => `Una ruta empieza con ${commands}.`,
    next: (commands) => `Después: ${commands}.`,
    then: ", después ",
    on: (branch, facts) => `En ${branch}: ${facts}.`,
    last: "Un último paso termina la ruta.",
    needs: (branch, facts) => `A ${branch} aún le falta: ${facts}.`,
  },
};

/** Build deterministic story and guidance text from trusted puzzle mechanics. */
export function createTemplateLocalizations(candidate: PuzzleCandidate, family: string, seed: string): PuzzleLocalizations {
  const themeIndex = hash(`${family}|${seed}`) % THEMES.en.length;
  const hints = createHints(candidate, family);
  const empty = (locale: Locale) => ({
    en: "the repository's existing work",
    ca: "la feina que ja hi ha al repositori",
    es: "el trabajo existente del repositorio",
  })[locale];
  const title = (locale: Locale) => THEMES[locale][themeIndex].title;
  const description = (locale: Locale) => ({
    en: `The ${THEMES.en[themeIndex].subject} is being prepared. Use the illustrated target as your reference while reviewing ${empty("en")}.`,
    ca: `Preparem el ${THEMES.ca[themeIndex].subject} amb un últim retoc. Fes servir la il·lustració objectiu com a referència mentre revises ${empty("ca")}.`,
    es: `Preparamos el ${THEMES.es[themeIndex].subject} con un último retoque. Usa la ilustración objetivo como referencia mientras revisas ${empty("es")}.`,
  })[locale];
  const objectives = (locale: Locale) => ({
    en: ["Make main match the illustrated target."],
    ca: ["Fes que main coincideixi amb la il·lustració objectiu."],
    es: ["Haz que main coincida con la ilustración objetivo."],
  })[locale];
  const commitMessages = (locale: Locale) => Object.fromEntries(Object.entries(candidate.initialRepository.commits).map(([id, commit]) => {
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
  const build = (locale: Locale): PuzzleLocalization => ({
    title: title(locale), description: description(locale), objectives: objectives(locale), hints: hints[locale], commitMessages: commitMessages(locale),
  });
  return { en: build("en"), ca: build("ca"), es: build("es") };
}

/** Rebuilds the hint ladder, for candidates certified before the current copy existed. */
export function refreshTemplateHints(candidate: PuzzleCandidate, family: string): PuzzleCandidate {
  const hints = createHints(candidate, family);
  const localizations = candidate.localizations && Object.fromEntries(LOCALES.map((locale) => [locale, { ...candidate.localizations![locale], hints: hints[locale] }])) as PuzzleLocalizations;
  return { ...candidate, hints: hints.en, ...(localizations ? { localizations } : {}) };
}

/**
 * Accepts only bounded plain-text title/description pairs for every locale.
 * Returns undefined for malformed data. Lexical screening does not verify story claims against puzzle mechanics.
 */
export function applyStoryText(candidate: PuzzleCandidate, input: unknown): PuzzleCandidate | undefined {
  if (!plainRecord(input) || !exactKeys(input, LOCALES)) return undefined;
  const localizedText = {} as Record<Locale, { title: string; description: string }>;
  for (const locale of LOCALES) {
    const entry = input[locale];
    if (!plainRecord(entry) || !exactKeys(entry, ["title", "description"])) return undefined;
    if (!safeStoryString(entry.title, DEFAULT_PUZZLE_LIMITS.maxTitleLength) || !safeStoryString(entry.description, DEFAULT_PUZZLE_LIMITS.maxDescriptionLength)) return undefined;
    localizedText[locale] = { title: entry.title, description: entry.description };
  }
  const localizations = candidate.localizations ? structuredClone(candidate.localizations) : createTemplateLocalizations(candidate, "daily", candidate.id);
  for (const locale of LOCALES) {
    localizations[locale] = { ...localizations[locale], ...localizedText[locale] };
  }
  const english = localizedText.en;
  return { ...candidate, title: english.title, description: english.description, localizations };
}

function safeStoryString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum &&
    !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value) &&
    !/(?:https?:\/\/|www\.|<\/?[a-z][^>]*>|```|`|\b(?:git|cherry-pick|revert|rebase|merge|checkout|switch|branch|commit)\b|\b[A-Za-z][A-Za-z0-9_-]{0,47}\b\s*(?:;|&&|\|))/i.test(value) &&
    !/[<>`{}[\]\\]/.test(value);
}

interface RouteCommand {
  command: string;
  /** switch and log only position the player; they change no branch. */
  setup: boolean;
  branch: string;
  changes: SemanticChange[];
  targetBranchState: SemanticState;
}

/**
 * Each hint is more specific than the last: a strategy when there is one, what to inspect,
 * then the route one step at a time with what each step does. The final command stays
 * out so the published definition never holds the whole private proof.
 */
function createHints(candidate: PuzzleCandidate, family: string): Record<Locale, string[]> {
  const route = traceRoute(candidate);
  let shown = route.length;
  while (shown > 0 && route[shown - 1].setup) shown -= 1;
  shown = Math.max(0, shown - 1);

  const strategy = STRATEGY_HINTS[getHintStyle(candidate, family)];
  const reference = firstReference(candidate);
  const reservedHints = (strategy ? 1 : 0) + (reference ? 1 : 0) + 1;
  const steps = groupRouteSteps(route.slice(0, shown), DEFAULT_PUZZLE_LIMITS.maxHints - reservedHints);
  const lastShownState = steps.at(-1)?.at(-1)?.targetBranchState ?? getSnapshot(candidate.initialRepository, candidate.initialRepository.branches[candidate.target.branch]);
  const remaining = diffSnapshots(lastShownState, candidate.target.snapshot).filter((change) => change.to !== undefined);

  return Object.fromEntries(LOCALES.map((locale) => {
    const copy = HINT_COPY[locale];
    const inspect = reference && (reference.kind === "commit" ? copy.inspectCommit(reference.id) : copy.inspectBranch(reference.id));
    const finish = remaining.length > 0 ? `${copy.last} ${copy.needs(candidate.target.branch, describeChanges(remaining, locale))}` : copy.last;
    return [locale, [
      ...(strategy ? [strategy[locale]] : []),
      ...(inspect ? [inspect] : []),
      ...steps.map((step, index) => describeRouteStep(step, index, locale)),
      withinHintLimit(finish, copy.last),
    ]];
  })) as Record<Locale, string[]>;
}

function traceRoute(candidate: PuzzleCandidate): RouteCommand[] {
  let repository = cloneRepository(candidate.initialRepository);
  // Generation can run past the first win; the shortest route ends there.
  const commands = routeThroughFirstWin(candidate, candidate.solutionCommands) ?? candidate.solutionCommands;
  return commands.map((command) => {
    const branch = repository.currentBranch;
    const result = executeCommand(repository, command);
    const changes = result.ok
      ? diffSnapshots(getSnapshot(repository, repository.branches[branch]), getSnapshot(result.repository, result.repository.branches[branch]))
      : [];
    if (result.ok) repository = result.repository;
    const parsed = parseGitCommand(command);
    return {
      command, branch, changes,
      setup: parsed.ok && (parsed.action.type === "switch" || parsed.action.type === "log"),
      targetBranchState: getSnapshot(repository, repository.branches[candidate.target.branch]),
    };
  });
}

function firstReference(candidate: PuzzleCandidate): { kind: "commit" | "branch"; id: string } | undefined {
  const parsed = candidate.solutionCommands[0] ? parseGitCommand(candidate.solutionCommands[0]) : undefined;
  if (!parsed?.ok) return undefined;
  const { action } = parsed;
  if (action.type === "cherry-pick" || action.type === "revert") return { kind: "commit", id: action.commit };
  if (action.type === "switch" || action.type === "merge") return { kind: "branch", id: action.branch };
  if (action.type === "rebase" || action.type === "interactive-rebase") return { kind: "branch", id: action.onto };
  return undefined;
}

/** A switch means nothing alone, so it travels with the command it sets up. */
function groupRouteSteps(route: RouteCommand[], maxSteps: number): RouteCommand[][] {
  const steps: RouteCommand[][] = [];
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

function describeRouteStep(step: RouteCommand[], index: number, locale: Locale): string {
  const copy = HINT_COPY[locale];
  const commands = step.map(({ command }) => formatRouteCommand(command)).join(copy.then);
  const sentence = index === 0 ? copy.start(commands) : copy.next(commands);
  const byBranch = new Map<string, Map<string, SemanticChange>>();
  for (const { branch, changes } of step) {
    const net = byBranch.get(branch) ?? new Map<string, SemanticChange>();
    for (const change of changes) net.set(change.property, change);
    byBranch.set(branch, net);
  }
  const effects = [...byBranch].filter(([, net]) => net.size > 0).map(([branch, net]) => copy.on(branch, describeChanges([...net.values()], locale)));
  return withinHintLimit([sentence, ...effects].join(" "), sentence);
}

function describeChanges(changes: SemanticChange[], locale: Locale): string {
  return changes.slice(0, 3).map(({ property, to }) => {
    const name = PROPERTY_NAMES[property]?.[locale] ?? property;
    return `${name} → ${VALUE_NAMES[String(to)]?.[locale] ?? String(to)}`;
  }).join(", ");
}

/** Interactive rebase commands carry their todo list on extra lines. */
function formatRouteCommand(command: string): string {
  const [first, ...todo] = command.split("\n");
  return todo.length > 0 ? `${first} (${todo.join(", ")})` : first;
}

function withinHintLimit(text: string, fallback: string): string {
  return text.length <= DEFAULT_PUZZLE_LIMITS.maxHintLength ? text : fallback;
}

type HintStyle = "dependency" | "repair" | "bundle" | "prepare-and-integrate" | "clean-room-integration";

function getHintStyle(candidate: PuzzleCandidate, family: string): HintStyle {
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
  const hasDependency = pickedIds.some((id) => pickedIds.some((other) => other !== id && isAncestor(other, id, commits)));
  return hasDependency ? "dependency" : "bundle";
}

function isAncestor(ancestor: string, descendant: string, commits: PuzzleCandidate["initialRepository"]["commits"]): boolean {
  const pending = [...(commits[descendant]?.parents ?? [])];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === ancestor) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(commits[current]?.parents ?? []));
  }
  return false;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0) % THEMES.en.length;
}
