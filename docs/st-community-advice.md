# Community-grounded advice wording

The coach uses the community terms **Left**, **Center**, **Right**, **Pocket**
(column 10), **Well** (column 8), **center overhang**, **Tetris**, and **mino parity**
where the checked move supports that description. Guide references appear as
clickable links below the live explanation, with the relevant chapter or section.
No unverified heading anchors are invented.

The references explain concepts, not the correctness of a particular generated
move. Their tooltips make the scope explicit. In particular:

- A local flat-left placement is not a universal keep-left-flat rule.
- A finite paired-T repair does not establish a completed community Reset.
- A visible replacement Z does not establish whether the historical Extra Z is
  still available.
- Center overhang shape does not prove whole-run piece balance or indefinite play.
- Flamewheel's guide uses older color-based piece names and timed-Ultra context.

Sources are [Shocky's ST Stacking Guide](https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit)
(chapters 1, 3.1, 3.2, 3.3–6 and 4 as relevant) and
[Flamewheel's ST Stacking Guide](https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking)
(Center Stacking, Left-Side Stacking, Tetrising).
The source descriptions are fixed in the planner. The UI separately allowlists
only their exact HTTPS URLs, renders labels as text, and hides references when
there is no current validated recommendation. Imported snapshot metadata cannot
supply links or HTML.

## Remaining-move wording

One presentation function regenerates the explanation and references after
planning, revalidation, held inputs, and completed locks. HOLD instructions come
from the remaining first-move witness. A retained center-only suffix no longer
claims to be a scoring-and-cleanup route. Construction text describes the current
T, center-building, cap-replacement or TSD stage, rather than repeating already
completed parts of the original route. Placement counts include the current move.

Budget failures say the search limit was reached, without conflating node limits
with elapsed time or claiming a continuation is impossible. Static help now
correctly distinguishes unlimited-hold st-zero-v2 from legacy one-hold st-zero-v1.

This change does not modify legality, search expansion, candidate ranking,
resource reservations or commitment acceptance. Tests cover actual replayed
construction stages and safe actual-page reference rendering. Human review of
clarity and usefulness remains important, especially for unusually shaped stacks.
