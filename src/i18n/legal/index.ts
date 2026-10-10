import type { Locale } from "../locales";
import { ca } from "./ca";
import { en } from "./en";
import { es } from "./es";
import type { LegalDocument } from "./types";

export * from "./types";

export const LEGAL: Record<Locale, LegalDocument> = { en, es, ca };
