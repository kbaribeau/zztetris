/* Public-piece query adapter. This reports necessary supply/resource matches,
 * never placement witnesses or permission to bypass normal route admission. */
(function (root, factory) {
  const api =
    typeof module === "object" && module.exports
      ? factory(
          require("./st-left-contours"),
          require("./st-rules"),
          require("./st-structure"),
        )
      : factory(root.STLeftContours, root.STRules, root.STStructure);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.STLeftDependencies = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (C, R, S) {
  "use strict";
  function query(
    state,
    {
      heights,
      resources = null,
      centerDebt = [],
      center,
      right,
      allowCrossing = false,
      allowIntervening = false,
      allowHold = true,
      maxStates,
    } = {},
  ) {
    const geometry =
      state.board && !(heights && center && right)
        ? S.geometry(state.board)
        : null;
    heights = heights || S.leftSurface.heights(state.board);
    center = center || geometry?.center || {};
    right = right || geometry?.right || {};
    const reserved = new Set(
      (resources?.pendingCenter || []).flatMap((p) =>
        (p.alternatives || []).map((a) => a.piece),
      ),
    );
    for (const debt of centerDebt)
      for (const a of debt.alternatives || []) reserved.add(a.piece);
    if (center?.status === "supported-partner-completion")
      for (const c of center.completions || [])
        if (c.patternSupport === "reference-supported") reserved.add(c.piece);
    const token = (type, p) =>
      type ? { type, id: p?.type === type ? (p.id ?? null) : null } : null;
    const supply = {
      active: token(state.active?.type, resources?.active),
      hold: token(state.hold, resources?.hold),
      queue: state.queue.map((type, i) => token(type, resources?.queue?.[i])),
      canHold: state.canHold,
    };
    const canUse = (piece, index, steps) => {
      if (!piece || reserved.has(piece.type) || piece.type === "T")
        return false;
      if (
        piece.type === "I" &&
        (right?.cycle?.prepareColumn != null ||
          right?.cycle?.cleanupColumns?.length)
      )
        return false;
      if (piece.type === "S" || piece.type === "L")
        return (
          piece.id !== null &&
          (resources?.["hanging" + piece.type] || []).some(
            (p) => p.id === piece.id,
          )
        );
      if (piece.type === "Z") {
        if (right?.completions?.length || resources?.extraZ !== "available")
          return false;
        const allowance = Number.isSafeInteger(resources.extraZRemaining)
          ? resources.extraZRemaining
          : 1;
        return (
          steps.filter((s) => s.dependency && s.piece.type === "Z").length <
          allowance
        );
      }
      return "IJO".includes(piece.type);
    };
    const result = C.candidates(heights, supply, {
      canUse,
      maxStates,
      allowCrossing,
      allowIntervening,
      allowHold,
      unlimitedHold: state.rules === R.PROFILE.id,
    });
    return {
      ...result,
      reserved: [...reserved].sort(),
      executionVerified: false,
    };
  }
  return Object.freeze({ query });
});
