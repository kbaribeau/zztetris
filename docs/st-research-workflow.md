# ST research: process and evidence contract

Use the repository's collaborative-review or controlled-experiment skill for
its applicable task. Current assignments, permissions, deadlines and outcomes
belong in local evidence, not this process.

## Execute the maintained contract

The [evaluation command and executable schema](st-evaluation-contract.md) own
protocols, normalized observations, correctness receipts, aggregate acceptance,
uncertainty, retrospective compatibility and report generation. Use that command
instead of copying a Markdown report format. The
[simulation contract](st-simulation.md) owns actual input generation, timed
execution, replay and existing comparison commands. Read current budgets and
runtime from the source, not historical examples.

For routine diagnostic simulation batches, use four parallel episode workers
(`--parallel 4`) as recommended in the simulation contract. Use
`--no-search-timeout` only as an explicit diagnostic choice. Parallel results
remain descriptive: CPU contention and nested wall timers can change decisions.
The production acceptance procedure below remains serial with ordinary timeouts.

For an engine change, freeze sources, actual inputs, cohorts, explicit metrics,
thresholds, uncertainty rules, budgets and stopping caps before the first planner
call. Run matched baseline/candidate serially from isolated worktrees. Inspected
inputs are development cases, not fresh validation. Retain every failed,
incomplete and losing attempt. Do not reinterpret missing data as zero or
change criteria after seeing results and still call them predeclared.

An individual bad simulation is not an automatic blocker. Declared aggregate
criteria govern regression; explicit correctness violations remain separate.
A simulation completing is not correctness proof. Keep source-bound full-suite,
replay and audit receipts, and independent review distinct.
Phase/reset interpretations do not alter raw counts. The general goal of 85
lines after a first reset is not an implicit branch acceptance gate.

## Information and proof boundaries

Separate community criterion (cite its source), engineering interpretation
(justify its threshold), observed result (identify source/input evidence), and
hypothesis. See [architecture](../ST-LAB.md), [rules](st-rules-contract.md),
[acceptance map](st-milestone-acceptance.md), [community wording](st-community-advice.md)
and [source corpus](st-fixture-corpus.md).

Seed, private future and evaluator metadata never enter coach requests. Revealed
pieces enter public history at the actual draw boundary. Geometry, executable
reachability, piece identity, HOLD order, original-bag accounting, permissions
and completed bounded proofs are different claims. Unknown/truncated history
remains unknown. A finite repair is not a Reset or indefinite sustainability.

For player review use the skill's [packet reference](../.agents/skills/st-collaborative-review/references/review-packet.md).
Preserve the exact pre-lock public session and connected history. Replay proposed
alternatives with actual rules and reveal order. Validate exports against their
recorded states. Recorded replay does not rerun policy or prove a rejected continuation impossible.

## Evidence, review and delivery

Keep protocols, raw traces, private streams, logs, manifests, screenshots,
sessions, reports and source bundles outside every Git worktree. Commit ordinary
source, schemas, maintained helpers and independently justified minimized test
fixtures. Do not turn fixture IDs into policy answers. Maintain a local index of
exact source/inputs, commands, all attempts, reviews, outcomes and limitations.
Hashes establish byte identity, not authenticity or correctness.

Use focused tests, the complete unfiltered suite and independent review of exact
source/raw evidence. After committing, retain a clean-commit full-suite receipt.
Do not describe separately tested changes as a verified combination. Run relevant
automated Worker checks or record the exact blocker. Respect
[test semantics](../TESTING.md).

Inspect status before edits; preserve unrelated work. Coordinate timed CPU work;
never run planners and suites simultaneously. Do not weaken gates to meet a
window. Publication needs current authorization, intended paths only, remote
advancement checks and a non-forcing update; verify the resulting remote tree
and applicable CI. Distinguish accepted, rejected, incomplete, blocked and
not-run work. Local commits alone are not publication.

### Targeted known landings

The planner's recorded-Left-route lane generates grounded target poses matching
its current contour stage before asking the rules kernel for witnesses. The
canonical immediate Right lane similarly requests only cap Z, full right TSD,
and competing cleanup-I targets. Geometry is not a reachability certificate:
`STRules.targetedPlacements` replays direct templates from each actual HOLD
supply state, then uses bounded targeted reachability for unresolved spins or
blocked starts. Its `complete` flag covers only the requested targets, not all
possible moves. The ordinary fallback still enumerates uncatalogued options.

The geometric prefilter must retain all progress-compatible target/spin/supply
outcomes. Resource identities, notch/access checks and admission remain separate
and unchanged. Metrics record geometric work, direct witnesses and fallback
nodes; the work is charged to the existing shared budget. A direct witness
checks inputs but avoids exploring a movement tree. No path can be accepted only
because a contour or target matches.
