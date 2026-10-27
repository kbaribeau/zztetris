---
name: st-controlled-experiment
description: Run or audit a bounded ST-lab policy experiment with frozen sources, paired serial evaluation, complete local evidence, and explicit acceptance limits. Use for authorized autonomous research or a controlled test following player review, not as permission for open-ended optimization or publication.
---

# Controlled ST experiment

Use the [shared research process](../../../docs/st-research-workflow.md) as the evidence and acceptance contract. Read the existing simulation, test and feature contracts it links instead of reimplementing their mechanics.

## Start with a bounded question

1. Confirm the current hypothesis, allowed changes, execution environment, compute budget, stopping condition and commit/publication permissions. Resolve a missing required permission before the dependent action; do not inherit yesterday's deadline or work authorization.
2. Inspect repository status and current source/base. Use an isolated worktree for concurrent experiments; preserve others' tracked and untracked work. Coordinate timed CPU ownership before launching search, tests or performance measurements.
3. Write a local predeclared protocol outside Git: baseline and candidate identities, fixed input cohort, runtime/budgets/caps, required controls, primary and safety metrics, acceptance/rejection criteria, repeats, and time limit. Label development cases as development cases; an inspected seed is not an untouched holdout.
4. Investigate the smallest plausible mechanism. Review community evidence where it governs the claim; label conservative engineered bounds as such. Do not tune to hidden future pieces, fixture IDs, or known answers.

## Execute and evaluate

1. Reproduce the behavior and run focused behavioral tests. Freeze relevant source hashes before the timed cohort. Do not edit those sources during a run.
2. Run baseline and candidate serially on matched actual inputs, configuration and host conditions. Read current pinned runtime and production search settings from the repository; never enlarge a budget silently to obtain a favorable result. Keep all attempts, including crashes, partial runs and losing repeats.
3. Use recorded-action replay and Fumen/session validation to check the evidence. These do not rerun the policy or establish its strategic quality. Reconcile summaries with actual lock/clear events and resource accounting, including controls that did not improve.
4. Report every predeclared pair and its stop classification. Reject invalid comparisons rather than quietly dropping inconvenient seeds. If a fixed-seed timed rerun diverges, retain both and narrow the conclusion.
5. For an engine change proposed for acceptance, run the complete unfiltered suite and obtain independent review of the exact source and raw evidence. Include change-appropriate browser checks or an explicit blocker; DOM tests are not browser evidence. Keep rejected variants locally as evidence, not as accepted source changes.

## Finish honestly

- Accept only the predeclared, measured scope; full tests alone do not establish policy improvement. After an authorized commit, retain a clean-revision full-suite receipt and bind it to that exact SHA. Do not claim untested combinations of separately good changes are validated.
- Save a concise local index of what changed, all results, source identities, reproducible commands, review findings, limitations and next unanswered question. Generated logs, traces, Fumens, sessions, receipts and archives remain outside Git.
- Report accepted, rejected, inconclusive, blocked and not-run work distinctly. Stop new work early enough to honor the current window; preserve partial results when a limit is reached. Do not lower gates to meet the deadline.
- A local commit is not publication. Publish only with current authorization, using verified available tools and a non-forcing expected-parent update; then verify the remote revision. See the shared process for concurrency and delivery checks.
