---
name: st-collaborative-review
description: Review an ST-lab decision or player-proposed alternative together using a verified Fumen, replay-backed coaching session, and controlled counterfactual. Use when the player is participating in strategy diagnosis, not for unrelated UI or ordinary-engine work.
---

# Collaborative ST review

Turn a specific observed decision into a shared, reproducible question before changing policy. Read the [shared research process](../../../docs/st-research-workflow.md), especially evidence boundaries, review artifacts, and acceptance. Follow the task's current scope and permissions; this skill does not authorize editing, committing, publishing, or switching execution environments.

## Establish the case

1. Identify the source revision and the exact disputed lock: recorded move number, Fumen page, active piece/HOLD, and whether the displayed board is before or after that lock. Keep those labels consistent throughout the discussion.
2. Recover the actual public request and connected history immediately **before** the disputed lock. Distinguish a retained recommendation from newly generated advice. Do not reconstruct historical S/L/Z permission from the final board or from future outcomes.
3. State the question in ordinary language: what the coach chose, what the player expected, and which claim needs checking. Separate source-backed community criteria from implementation thresholds and from a new hypothesis.

## Give the player a usable review packet

- Provide an English-commented Fumen showing the relevant prefix and decision boundary, plus a compact coaching-session JSON at the pre-lock state. Include all available replay-backed coaching history required by the supported session format; compact means whitespace removal, not deleting context.
- Decode the Fumen and compare its fields, operations and labels with the recorded states. Import/parse the session through the production session contract, then compare the round-tripped public position and coaching context. A Fumen image or position-only snapshot is not a substitute for historical resource accounting.
- Keep hidden future input, RNG state and evaluator provenance out of the coaching session and advice request. Explain any missing/truncated history, version warning, finite queue, or import limit rather than fabricating a complete session.
- Give the Fumen page and move number where the player should look, what to try, and one focused question. Save the packet locally outside Git even if no code change is accepted.

## Test the proposed alternative

1. Replay the player's actual proposed actions from the same pre-lock state using the real rules, HOLD/draw transitions and reveal schedule. If the proposal is ambiguous, ask which order/placement was intended rather than silently substituting an easier move.
2. If two placement orders are relevant, replay both. Check exact piece identities and original bags, Center partner debt, Hanging S/L and Extra Z before and after each actual lock. A prettier endpoint is not proof of equivalent accounting or access.
3. Separate the results: legal action sequence; resource/structure compliance; visible executable continuation; policy's ability to find it under the approved budget; later strategic outcome. A failed bounded search is not proof of impossibility.
4. Present what the replay established and what remains uncertain. Do not replace the player's proposal with an implementation threshold merely to produce a passing test.
5. When an engine experiment is authorized, use [st-controlled-experiment](../st-controlled-experiment/SKILL.md) and the shared acceptance process. Reproduce the issue, change one defensible mechanism, then compare against the original baseline. Otherwise stop at the diagnosis and proposed next test.

If the player becomes unavailable, continue only work already authorized. An unanswered question or elapsed time does not authorize an autonomous implementation block.
