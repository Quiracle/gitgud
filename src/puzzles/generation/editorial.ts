import { DEFAULT_PUZZLE_LIMITS } from "../policy";
import { parseGitCommand } from "../../engine";
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

/** Build deterministic story and guidance text from trusted puzzle mechanics. */
export function createTemplateLocalizations(candidate: PuzzleCandidate, family: string, seed: string): PuzzleLocalizations {
  const themeIndex = hash(`${family}|${seed}`) % THEMES.en.length;
  const firstSolutionCommand = candidate.solutionCommands[0];
  const parsedFirstCommand = firstSolutionCommand ? parseGitCommand(firstSolutionCommand) : undefined;
  const firstCommitReference = parsedFirstCommand?.ok && (parsedFirstCommand.action.type === "cherry-pick" || parsedFirstCommand.action.type === "revert")
    ? parsedFirstCommand.action.commit
    : undefined;
  const step = firstSolutionCommand ?? "git log";
  const hintStyle = getHintStyle(candidate, family);
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
  const hints = (locale: Locale) => {
    const first = {
      dependency: {
        en: "Inspect the linked changes in order; a later change may depend on an earlier value.",
        ca: "Revisa els canvis relacionats per ordre; un canvi posterior pot dependre d'un valor anterior.",
        es: "Inspecciona los cambios relacionados en orden; un cambio posterior puede depender de un valor anterior.",
      },
      repair: {
        en: "Compare main with the target and identify any current change that needs repair.",
        ca: "Compara main amb l'objectiu i identifica si cal corregir algun canvi actual.",
        es: "Compara main con el objetivo e identifica si hay algún cambio actual que corregir.",
      },
      bundle: {
        en: "Review the useful changes across the branches and compare them with the target.",
        ca: "Revisa els canvis útils de les branques i compara'ls amb l'objectiu.",
        es: "Revisa los cambios útiles de las ramas y compáralos con el objetivo.",
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
    }[hintStyle][locale];
    const second = firstCommitReference
      ? { en: `Inspect the changes in commit ${firstCommitReference} and compare them with the target.`, ca: `Revisa els canvis del commit ${firstCommitReference} i compara'ls amb l'objectiu.`, es: `Inspecciona los cambios del commit ${firstCommitReference} y compáralos con el objetivo.` }[locale]
      : { en: "Compare the changes on each branch with the target state.", ca: "Compara els canvis de cada branca amb l'estat objectiu.", es: "Compara los cambios de cada rama con el estado objetivo." }[locale];
    const third = {
      en: `One possible route begins with ${step}; this may not be the only way to reach the target.`,
      ca: `Una ruta possible comença amb ${step}; potser no és l'única manera d'arribar a l'objectiu.`,
      es: `Una ruta posible empieza con ${step}; quizá no sea la única forma de alcanzar el objetivo.`,
    }[locale];
    return [first, second, third];
  };
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
    title: title(locale), description: description(locale), objectives: objectives(locale), hints: hints(locale), commitMessages: commitMessages(locale),
  });
  return { en: build("en"), ca: build("ca"), es: build("es") };
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
