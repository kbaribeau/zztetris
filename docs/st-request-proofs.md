# Request-local completed proofs and certified fallbacks

`STRules.withQueries` creates a bounded synchronous query scope. `plan` and
`decide` share it through nested calls and discard it in `finally`. There is no
persistent move graph, cross-worker reuse, changed repair grammar or new budget.
Only completed placement enumerations and hypothetical T-entry queries are saved.
Timeouts and predicate-stopped enumerations remain unfinished. Completed negatives
apply only to that precise geometric query, not to overall strategy feasibility.

Placement keys include the entire rules state and allowHold, conservatively
including pose/rotation provenance, board, HOLD, queue, bag, cursor and revision.
T-entry's only semantic input is its board: it always tests the rules kernel's
fresh hypothetical T, not actual supply. Actual-pose/supply and resource checks
still replay real witnesses. Predicate queries are not reused. Cache entries are
serialized before callers can mutate results and parsed afresh on each hit.
At most 64 entries / 8 MiB of estimated UTF-16 key+value serialization are retained;
this excludes JS Map/object overhead and is not a process-RSS limit.

`queryStatus` distinguishes proven, failed-within-scope and unfinished work.
Resource repair also identifies its finite grammar depth/completion scope. No
unfinished repair is memoized as a completed negative. Resource endpoint memo keys
bind full observation, resource identities (including unclassified S) and notch
phase. Existing successful repair and completed gap-access caches remain active.
Cache hits report zero newly visited nodes; `metrics.queries.avoidedNodes` separately
reports the original completed expansion cost. Inclusive repair/access counters
must not be added to their child BFS counters.

The planner uses the same final witness/resource/repair/scoring/gap checks to admit
an internal maintenance fallback as to return normal advice. Existing commitments
and protected cleanup routes are admitted before optional comparisons. Ordinary
candidates can be admitted when encountered, including a candidate from an
incomplete layer; this never increments completeDepth. A fallback is used only if
later validation/search supplies no checked move. It is a private clone bound to
this observation and synchronous invocation; user callbacks, imported flags and
serialized advice cannot register one. Current resource replay remains mandatory.
The original ranking and equal-horizon commitment comparisons are unchanged.

Metrics retain all spent search/validation work, admission attempts/failures,
firstCertified node count and (when usageTelemetry is enabled) elapsed time. A
selected fallback is identified explicitly and reports incomplete search. Proof
reuse can reduce nodes without reducing wall time because keying, serialization
and cloning cost time. Benchmark both, at the unchanged 1500 ms / 45000-node limits.
