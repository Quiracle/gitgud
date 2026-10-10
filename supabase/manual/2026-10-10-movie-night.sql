-- Publishes the hand-authored easy daily "Movie night: lose the shades" for 2026-10-10 (UTC).
-- Generated from src/puzzles/daily/2026-10-10-movie-night.json, which is proven solvable
-- by src/puzzles/daily/movieNight.test.ts. Paste into Supabase -> SQL Editor and run once.
--
-- If a puzzle is already current for this date (e.g. the scheduled AI job ran), it is kept
-- for historical results but stops being current, and this puzzle is published as the
-- next version with its own ID. Running the script again is a no-op.
do $publish$
declare
  target_date constant date := date '2026-10-10';
  puzzle_definition jsonb := $definition${"schemaVersion":2,"themeId":"chicken-v1","id":"daily-2026-10-10","version":1,"kind":"daily","slug":"daily-2026-10-10","publishedOn":"2026-10-10","difficulty":"easy","title":"Movie night: lose the shades","description":"The chicken is getting cosy for movie night. Someone committed red sunglasses on main, which is no use in a dark cinema, and the turquoise scarf is still waiting on the cozy branch. Main is shared, so undo the sunglasses without rewriting it, then bring the scarf in.","objectives":["Finish on main with the target chicken: blue hat, turquoise scarf, no sunglasses.","Undo the sunglasses commit (m12) with git revert.","Merge the cozy branch with a real merge commit and leave cozy where it is."],"initialRepository":{"initialState":{"body":"cream","sunglasses":"none","hat":"none","scarf":"none","crest":"none","longLegs":"none"},"currentBranch":"main","head":"m12","nextGeneratedId":1,"branches":{"main":"m12","cozy":"k21"},"commits":{"a10":{"id":"a10","parents":[],"message":"Hatch the movie-night chicken","changes":[],"provenance":{"type":"original"}},"m11":{"id":"m11","parents":["a10"],"message":"Pull on a blue beanie","changes":[{"type":"set","property":"hat","from":"none","to":"blue"}],"provenance":{"type":"original"}},"m12":{"id":"m12","parents":["m11"],"message":"Wear red sunglasses indoors","changes":[{"type":"set","property":"sunglasses","from":"none","to":"red"}],"provenance":{"type":"original"}},"k21":{"id":"k21","parents":["m11"],"message":"Knit a turquoise scarf","changes":[{"type":"set","property":"scarf","from":"none","to":"turquoise"}],"provenance":{"type":"original"}}}},"target":{"branch":"main","snapshot":{"body":"cream","sunglasses":"none","hat":"blue","scarf":"turquoise","crest":"none","longLegs":"none"},"branchHeads":{"cozy":"k21"},"requiredProvenance":[{"type":"revert","sourceCommit":"m12"},{"type":"merge","sourceCommit":"k21"}]},"allowedCommands":["log","switch","merge","revert"],"hints":["git revert m12 adds a new commit that takes the sunglasses off, without rewriting main's history.","main and cozy have both moved on since m11, so git merge cozy from main makes a real merge commit and leaves cozy where it is."]}$definition$::jsonb;
  solution jsonb := $solution$["git revert m12","git merge cozy"]$solution$::jsonb;
  next_version integer;
  target_id text;
begin
  if exists (
    select 1 from public.daily_puzzles
    where published_on = target_date and is_current
      and daily_puzzles.definition->>'title' = puzzle_definition->>'title'
  ) then
    raise notice 'This puzzle is already the current daily for %.', target_date;
    return;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
    from public.daily_puzzles where published_on = target_date;
  target_id := case when next_version = 1 then 'daily-' || target_date
                    else 'daily-' || target_date || '-v' || next_version end;
  puzzle_definition := puzzle_definition
    || jsonb_build_object('id', target_id, 'slug', target_id, 'version', next_version);

  update public.daily_puzzles set is_current = false
    where published_on = target_date and is_current;

  insert into public.daily_puzzles (
    id, published_on, version, is_current, difficulty, schema_version, prompt_version,
    definition, generation_run_id, validation_status
  ) values (
    target_id, target_date, next_version, true, puzzle_definition->>'difficulty',
    (puzzle_definition->>'schemaVersion')::integer, 0, puzzle_definition, null, 'validated'
  );

  insert into public.daily_puzzle_private (puzzle_id, solution_commands)
    values (target_id, solution);

  raise notice 'Published % (version %) for %.', target_id, next_version, target_date;
end
$publish$;
