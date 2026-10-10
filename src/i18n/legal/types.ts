/** Facts the legal page states in every language. */
export const LEGAL_OWNER = "Maria Cuervo";
export const LEGAL_EMAIL = "mcuervoar00@gmail.com";
export const LEGAL_DOMAIN = "gitgudgame.lol";
export const LEGAL_REPOSITORY = "https://github.com/Quiracle/gitgud";
/** Bump whenever the wording changes in a way players should know about. */
export const LEGAL_UPDATED_ON = "2026-10-10";

export const LEGAL_SECTION_IDS = ["privacy", "cookies", "terms", "ai", "notice"] as const;
export type LegalSectionId = typeof LEGAL_SECTION_IDS[number];

/**
 * Body text may mark <b>bold</b>, <mail>an address</mail> and <url>https://…</url>;
 * the page turns only those tags into elements.
 */
export type LegalBlock =
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  /** Rows render as cards titled by their first cell; `code` sets that title in monospace. */
  | { kind: "table"; head: string[]; rows: string[][]; code?: boolean }
  /** A Cookie settings button that reopens the consent banner. */
  | { kind: "consent" };

export interface LegalSection {
  id: LegalSectionId;
  /** Short label for the jump chips. */
  chip: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  jumpTo: string;
  sections: LegalSection[];
}
