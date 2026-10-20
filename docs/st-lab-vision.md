# ST Lab vision

The ST lab helps players improve their ability to build and maintain ST structures through **optional, real-time placement recommendations during ordinary play**, paired with brief explanations using established Tetris-community terminology.

## Recommendation priorities

1. **Preserve continued, doubles-focused ST play:** maintain ST structure and a viable continuation within the advisor’s knowledge.
2. **Prefer straightforward execution and clear explanations.**
3. **Consider scoring potential afterward.**

When multiple placements offer comparably viable continuations, the advisor need not spend substantial computation distinguishing them. It recommends a placement—not “the correct placement”—and does not claim to prove indefinite sustainability.

## Player experience

- Show **one precise placement target and one brief reason** grounded in what the advisor actually evaluated.
- Begin from the active piece’s **actual current position and rotation**.
- Keep a sound target stable while revalidating its reachability and strategic suitability.
- Players remain free to choose another placement. Reassess the resulting position and recommend recovery toward viable ST play when possible.
- A keybinding hides or reveals **both the target and explanation**. Players can practice unaided and enable advice when unsure.
- When no supported ST continuation can be recommended, say so explicitly. This means the advisor cannot establish one—not that none exists.

## Information available to the advisor

Recommendations should be recomputable from the current board, active piece, hold, visible preview and applicable rules, including execution state needed to assess reachability.

Remembered gameplay history is not required. Unobserved bag history is treated as uncertainty rather than invented knowledge.

## Eventual scope

- Opening construction and ordinary filler placement.
- Left, Center and Right region management.
- T-spin doubles, quad cleanup and recovery toward continued ST play.
- **Every gravity setting supported by the trainer.**

T-spin triples and broader survival coaching are outside scope. Supporting existing gravity settings does not implicitly introduce other rulesets, automatic locking or different lock-delay behavior.

## Delivery and success

Implementation proceeds incrementally from the existing narrower advisor. Early versions may support only a clearly stated subset of situations and gravity settings.

**Success means players develop better independent ST judgment**, not merely achieve stronger results while following recommendations.

This document records the agreed direction, not a description of all currently shipped capabilities or authorization to implement the entire vision. See the [current ST lab documentation](../ST-LAB.md) for supported behavior.
