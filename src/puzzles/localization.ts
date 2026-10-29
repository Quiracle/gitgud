import type { Locale } from "../i18n/locales";
import type { Repository } from "../engine";
import type { PublicPuzzleDefinition } from "./types";

/** Copies a live repository and translates messages only for original commit identities. */
export function localizeRepository(puzzle: PublicPuzzleDefinition, repository: Repository, locale: Locale): Repository {
  const messages = puzzle.localizations?.[locale]?.commitMessages;
  if (!messages) return repository;
  let changed = false;
  const commits = { ...repository.commits };
  for (const [id, message] of Object.entries(messages)) {
    const commit = repository.commits[id];
    if (!commit || commit.message === message) continue;
    commits[id] = { ...commit, message };
    changed = true;
  }
  return changed ? { ...repository, commits } : repository;
}

/** Returns a display copy while preserving puzzle identity and all mechanics. */
export function localizePuzzle(puzzle: PublicPuzzleDefinition, locale: Locale): PublicPuzzleDefinition {
  const copy = puzzle.localizations?.[locale];
  if (!copy) return puzzle;
  const initialRepository = localizeRepository(puzzle, puzzle.initialRepository, locale);
  return {
    ...puzzle,
    title: copy.title,
    description: copy.description,
    objectives: copy.objectives,
    hints: copy.hints,
    initialRepository,
  };
}
