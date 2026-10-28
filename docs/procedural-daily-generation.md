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
- `constructiveGraph.ts` and `synthesis.ts`: compose bundled work, temporary regressions, contaminated tails and variable branch forks, then search for a proof. They do not select a complete authored puzzle. Discovery is heuristic; only the separate exhaustive evaluator can certify difficulty.
- `candidateArtifact.ts` and `proceduralPublication.ts`: individually bound private artifacts, runtime proof verification, and publication with optional AI story. The Edge entrypoint now uses this path in the draft, not the eight-template publisher. Production has not been changed.
- `daily_certified_candidates` migration and `scripts/refill-daily-puzzles.mjs`: private queue, atomic date/category reservation, no candidate reuse, novelty uniqueness, and offline replenishment. The gated GitHub workflow is not enabled or verified in production. Empty queues preserve difficulty and return `awaiting-candidate`; there is no template fallback.
- `publishedNovelty.ts`: compares every historical version using its stored private proof through the first current-rule win. The upload worker loads published history before proposing candidates. Unreadable history fails the comparison instead of silently being omitted. This does not rewrite historical definitions or results.

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

## Current replacement evidence

The constructive generator has now produced certified hard puzzles; the earlier random-graph failures above are retained as research history. A local worker run certified seeds `synthesis-403` and `synthesis-404` through five-command exclusion. Other hard candidates still exhaust search budgets and are not accepted. Terminal search pruning uses representatives that preserve every new final daily-winning snapshot; all intermediate histories still enumerate squash partitions. Differential tests compare with unrestricted enumeration and the original oracle.

Hard proofs may now contain six to ten commands while the evaluator still excludes every solution through five commands. The certificate records the lower bound and proof length separately; a nine-command proof is not claimed to be shortest. This admits richer compositions instead of requiring all hard puzzles to have exactly six-command solutions. Copy-only exclusion extends through the entire accepted proof length.

A fresh medium refill (`verify-history`, seeds 0–35) produced 14 distinct accepted cores across seven command patterns, after checking all 22 stored historical definitions fetched read-only on 2026-10-28. It rejected 146 of 160 proposals; none were accepted on incomplete search evidence. Seven accepted proofs still share the source-preparation command pattern. This is measurable progress, not proof of season-long variety.

The current local medium reserve contains 32 certified cores across ten order-independent operation groups. Refill added four puzzles beyond its 28-count target to bring the largest group below 35%. Readiness now requires at least four such groups in medium/hard, with none exceeding 35%; reservation prioritizes the least recently used group. Reordered operations count together. These groups are a coarse pacing safeguard, not proof of distinct reasoning or enjoyment.

The new queue migration passed isolated Postgres tests for privileges, reservation identity, empty-queue refill, source filtering, novelty uniqueness, and registration idempotency. The compiled Edge handler and pure publication pipeline have non-UI tests. Hosted concurrency, actual scheduled refill, and staging publication remain unverified.

Run the worker locally, then generate spoiler-free public review definitions:

```text
node scripts/refill-daily-puzzles.mjs --difficulty medium --target 14
node scripts/review-procedural-puzzles.mjs
```

An optional `--history-file daily-review.local/published-history.private.json` checks a private historical export offline. `--recertify-local` reruns current search on older local candidates; it never simply stamps a new fingerprint onto old evidence. Hosted certificate-upgrade handling remains outstanding. `--upload` requires the private HTTPS endpoint and generation secret, loads history and inventory itself, and registers verified artifacts. Files under `daily-review.local/candidate-reserve/` contain proofs and stay private. `procedural-review.md` links public-only examples using the development-only `?review=` selector.

Still required before rollout: reliable and diverse hard refill, a simulated season measuring repeated reasoning rather than only hashes or command patterns, staging publication and scheduled refill, certificate-upgrade handling for already queued candidates, and human playtesting of a broad batch. Candidate bindings and queue integration are implemented locally; they have not been deployed. None of these release requirements is satisfied by having eight passing template certificates.
