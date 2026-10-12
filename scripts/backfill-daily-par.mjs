/*
 * Review-only operational helper. Run with a service-role key after applying
 * 202610110002_daily_par_commands.sql. It reads a private proof server-side,
 * calculates only the scalar par, and writes that scalar for one current date.
 * It never prints or returns the private solution.
 */
import { createClient } from "@supabase/supabase-js";
import { validatePuzzleCandidate, CHICKEN_V2_SEMANTIC_POLICY } from "../supabase/functions/_shared/domain.bundle.js";

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Usage: node scripts/backfill-daily-par.mjs YYYY-MM-DD");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const daily = await supabase.from("daily_puzzles")
  .select("id,definition,par_commands")
  .eq("published_on", date)
  .eq("is_current", true)
  .single();
if (daily.error) throw daily.error;
if (daily.data.par_commands !== null) process.exit(0);
const privateProof = await supabase.from("daily_puzzle_private")
  .select("solution_commands")
  .eq("puzzle_id", daily.data.id)
  .single();
if (privateProof.error) throw privateProof.error;
const candidate = { ...daily.data.definition, solutionCommands: privateProof.data.solution_commands };
const validated = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
if (!validated.ok || validated.value.puzzle.parCommands === undefined) throw new Error("Stored daily does not have a valid winning proof.");
const updated = await supabase.from("daily_puzzles")
  .update({ par_commands: validated.value.puzzle.parCommands })
  .eq("id", daily.data.id)
  .is("par_commands", null);
if (updated.error) throw updated.error;
