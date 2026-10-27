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

### Repair witnesses and ordinary cavity admission

A visible resource-repair witness must remain usable when each of its future
locks becomes the next actual move. Resource repair therefore applies the same
translated, exact-cell newly sealed construction-cavity predicate as ordinary
admission, at every proposed repair step. A covered-cell count alone is not a
substitute: a placement can reduce that count while sealing a previously
side-accessible cell. Existing cavities and intentional Right reservoirs retain
their existing treatment. The shared geometry predicate does not replace
identity, phase, access, scoring, or other resource checks.

### Early-layer endpoint screening

Ordinary maintenance screening is scheduled separately from expansion. Bounded
internal opening/construction probes and requests below20000nodes keep their
existing allocation. For eligible ordinary requests, at the
root and nonfinal beam layers, access/resource screening may spend at most
`min(6000, floor(requestNodeLimit / 5))` newly visited nodes. It still examines
candidates in the existing rank order and admits only completed positive proofs.
The final beam layer and final admission can use the remaining shared budget.
This is an allocation of the existing live limit, not an additional allowance.

An unfinished access or repair result stays unknown; it is never cached as a
negative fact. A layer with interrupted endpoint screening does not advance
`completeDepth`. That field describes a completed expansion layer whose ranked
endpoint scan reached a checked candidate without unfinished competing proofs;
it does not assert exhaustive coverage beyond the beam or beyond the selected
candidate in rank order. `completedBeamDepth` separately records completed
placement expansion within the retained beam. An individually checked candidate
from that expansion may still be selected despite an unknown competitor. This
preserves the existing completed-expansion selection rule without treating an
unknown proof as a rejection or claiming the entire screening scope finished.
`certifiedHorizon` is set only after final resource/access admission, to the
selected continuation length (zero on failed final admission). Successful input
advancement, ordinary/construction commitment suffixes, revalidation and source
opening/scoring retention recompute it from the returned validated continuation;
serialized or older metric values carry no authority. A retained fully
admitted fallback reports its own length. None of these fields certifies
sustainability beyond the finite prefix. Metrics expose screening calls, actual nodes, unfinished
queries and budget stops. Completed query reuse and all state/history/HOLD/queue
bindings are unchanged. `searchIncomplete` also covers a local screening stop,
including when the overall request still had nodes available for later work.
