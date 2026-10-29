/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DAILY_PUZZLE_SOURCE?: "fixture" | "supabase" | "review";
  readonly VITE_DAILY_REVIEW_TEMPLATE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
