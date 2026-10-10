-- Publishes the hand-authored medium daily "Garden party: one tidy scarf" for 2026-10-10 (UTC).
-- Generated from src/puzzles/daily/2026-10-10-garden-party.json, which is proven solvable
-- by src/puzzles/daily/gardenParty.test.ts. Paste into Supabase -> SQL Editor and run once.
--
-- If a puzzle is already current for this date (e.g. the scheduled AI job ran), it is kept
-- for historical results but stops being current, and this puzzle is published as the
-- next version with its own ID. Running the script again is a no-op.
do $publish$
declare
  target_date constant date := date '2026-10-10';
  puzzle_definition jsonb := $definition${"schemaVersion":2,"themeId":"chicken-v1","id":"daily-2026-10-10","version":1,"kind":"daily","slug":"daily-2026-10-10","publishedOn":"2026-10-10","difficulty":"medium","title":"Garden party: one tidy scarf","description":"The chicken is off to a garden party. Its scarf took two tries (red, then turquoise), and the sunny-day look is waiting on the shades branch. Bring everything onto main, but tidy the scarf history into a single commit first.","objectives":["Finish on main with the target chicken: red crest, turquoise scarf, black sunglasses, blue hat.","Squash the two scarf commits into one before they reach main.","Merge the shades branch with a real merge commit and leave shades where it is."],"initialRepository":{"initialState":{"body":"cream","sunglasses":"none","hat":"none","scarf":"none","crest":"none","longLegs":"none"},"currentBranch":"main","head":"m11","nextGeneratedId":1,"branches":{"main":"m11","scarf":"s22","shades":"c32"},"commits":{"a10":{"id":"a10","parents":[],"message":"Hatch the party chicken","changes":[],"provenance":{"type":"original"}},"m11":{"id":"m11","parents":["a10"],"message":"Comb the crest red","changes":[{"type":"set","property":"crest","from":"none","to":"red"}],"provenance":{"type":"original"}},"s21":{"id":"s21","parents":["a10"],"message":"WIP: knit a red scarf","changes":[{"type":"set","property":"scarf","from":"none","to":"red"}],"provenance":{"type":"original"}},"s22":{"id":"s22","parents":["s21"],"message":"Re-knit the scarf in turquoise","changes":[{"type":"set","property":"scarf","from":"red","to":"turquoise"}],"provenance":{"type":"original"}},"c31":{"id":"c31","parents":["a10"],"message":"Add black sunglasses","changes":[{"type":"set","property":"sunglasses","from":"none","to":"black"}],"provenance":{"type":"original"}},"c32":{"id":"c32","parents":["c31"],"message":"Add a blue sun hat","changes":[{"type":"set","property":"hat","from":"none","to":"blue"}],"provenance":{"type":"original"}}}},"target":{"branch":"main","snapshot":{"body":"cream","sunglasses":"black","hat":"blue","scarf":"turquoise","crest":"red","longLegs":"none"},"branchHeads":{"shades":"c32"},"requiredProvenance":[{"type":"squash","sourceCommit":"s21"},{"type":"squash","sourceCommit":"s22"},{"type":"merge","sourceCommit":"c32"}]},"allowedCommands":["log","switch","merge","rebase","interactive-rebase"],"hints":["Switch to scarf and run git rebase -i main. Pick the red scarf commit and squash the turquoise one into it.","shades and main have both moved on since a10, so git merge shades makes a real merge commit and leaves shades where it is."]}$definition$::jsonb;
  solution jsonb := $solution$["git switch scarf","git rebase -i main\npick s21\nsquash s22","git switch main","git merge --ff-only scarf","git merge shades"]$solution$::jsonb;
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
