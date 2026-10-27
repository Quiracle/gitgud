# Daily generation: variety before rollout

The eight certified templates are useful examples and solver regression fixtures. They are not sufficient for the daily game. Changing story, colors, commit IDs, or branch names preserves the same puzzle. Certification of command count establishes difficulty bounds, not enjoyment or long-term variety. The current draft must not be treated as release-ready.

The product objective is a new reasoning problem each day: which work belongs together, which changes interfere, where preparation is needed, and what must be preserved. A command such as merge can recur without making two puzzles equivalent. Conversely, a different command order or a larger graph does not necessarily create a new problem.

## Implementation order

1. **Procedural mechanics and target discovery.** Generate branch forks, shared history, bundled edits, preconditions and temporary changes. Compose these relationships instead of selecting a complete authored puzzle. Reach targets through legal simulator play, retaining a private proof. Prefer natural routes that revert work in the checked-out branch's history. This preference only guides proposals; the solver must still consider every supported player action.
2. **Mechanical and strategic rejection.** Replay the proof with the normal validator, then exhaustively exclude shortcuts. The present 2/4/6-command thresholds remain provisional. Reject medium/hard proposals with an equally short copy-only solution. Assess preparation, temporary regressions, preservation of existing work, and meaningful interactions; do not make long copy sequences or extra distracting commits count as interesting difficulty.
3. **Novelty across the published history and reserve.** Compare mechanics after removing names, prose and colors. Add a separate solution-dependency comparison that ignores irrelevant graph decoration and commutations of independent operations. Command-verb patterns are a coarse pacing signal, not a novelty certificate. Select across different reasoning families; do not merely alternate eight fixed recipes.
4. **A replenished private reserve.** Run expensive generation/search in an offline scheduled worker such as a repository workflow. Consume immutable, individually certified candidates from a private queue through the existing managed publication service. Bind each certificate to the exact candidate and engine/evaluator version. Reserve the difficulty and candidate atomically for the date, replay on publication, and never reuse a consumed candidate under a fresh story. The reserve needs measured refill throughput, low-water monitoring and retries. A larger finite bank without replenishment would only postpone the original problem.
5. **AI story after mechanics are fixed.** The provider receives limited story context and returns only title/description in English, Catalan and Spanish. Repository, target, hints and proof are deterministic. Provider failure uses localized fallback prose. Existing daily puzzles, archive identities and player results remain unchanged.
6. **Batch playtesting and release evidence.** Present a varied, spoiler-free set for human playtesting. Measure whether players discover different approaches and whether unnecessary bookkeeping dominates. Test a simulated season for repeated decision structures and predictable scheduling, then demonstrate reserve refill and publication in staging. Only then replace the template publisher.

## What exists in the experiment

- `procedural.ts`: seeded graph generation, variable forks and bundles, temporary edits composed into histories, and legal forward walks yielding reachable targets. Localizations use the existing deterministic editorial layer.
- `proceduralCertification.ts`: one exhaustive search checks multiple targets on the same initial repository. It uses the engine's full command enumeration and normal victory validator. History stays in the search-state key. Resource exhaustion is unknown, never a passing certificate.
- `proceduralQuality.ts`: a separate copy-only search rejects proposals with the repetitive shortcut seen in playtesting. It does not restrict the player's commands.
- `novelty.ts`: a conservative graph fingerprint invariant to consistent renaming. It is not complete graph isomorphism and does not yet detect every repeated reasoning pattern. A match means reject for novelty; a difference alone does not mean the puzzle is enjoyable.
- `decisionCore.ts`: a second conservative fingerprint removes untouched branches and independent canceled decoration from the proof's relevant work. Tests cover distracting branches and reordered independent tasks. It is an initial reasoning-duplicate heuristic, not a complete solution-space comparison.
- `scripts/explore-procedural-dailies.mjs`: reproducible local batches, rejection counts, coarse command patterns, and private proof artifacts. No provider, database, publication, or UI calls.

Run, for example:

```text
node scripts/explore-procedural-dailies.mjs medium 40 120
```

Arguments are difficulty, graph count and seed offset. Reports are ignored local files under `daily-review.local/procedural/`; they contain solution spoilers and must not be served as public daily definitions. New reports record a hash of the bundled research source so results are tied to the tested implementation.

## Evidence and unresolved work

An initial random-graph run over 100 medium graphs proposed 924 targets. The normal-rule search rejected 886 for shorter solutions; 38 met the four-command bound, representing 27 fingerprints within that batch. A subsequent 40-graph run proposed 355 targets, rejected 332 shortcuts and another two copy-only solutions; 16 distinct fingerprints remained after duplicate filtering. These runs preceded the temporary-edit composition refinement, and are research observations, not release benchmarks.

Hard generation is not established: the initial 20-graph run rejected all 114 proposals, and a larger-graph 30-seed run rejected all 264. Increasing graph size and authored walk length did not make those puzzles hard. Adding temporary-edit compositions and exploring more walks over another 20 graphs produced 382 proposals: 377 had shortcuts and five exhausted the search budget. Zero qualified. The next generator iteration needs to construct interacting constraints deliberately and use solver feedback, not just increase graph size or sampling.

With the composition and decision-core checks, a fresh 20-graph medium run (seeds 300–319) produced 170 proposals, rejected 157 shortcuts, and retained eight distinct cores after normalization. This is evidence that the experimental machinery can find new medium problems, not that eight more examples solve the daily-content requirement. Research searches now have a 30-second per-graph time budget; incomplete searches remain unknown.

The batch oracle has differential tests against the existing single-target oracle, a certified workshop positive control, and budget-exhaustion checks. Proposal proofs and localization are validated. This verifies machinery, not fun.

Still required before rollout: reliable hard-puzzle generation, broader evaluation of solution-dependency novelty, comparisons against historical and queued puzzles, reserve/refill integration, candidate-bound certificates, staging publication, and human playtesting of a broad batch. None of these is satisfied by having eight passing template certificates.
