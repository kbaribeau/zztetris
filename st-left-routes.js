/* Root-only finite Left routes. Lookup supply is necessary, not a movement or
 * admission proof. Progress is earned only by the planner's emitted locks. */
(function (root, factory) {
  const api = typeof module === "object" && module.exports
    ? factory(require("./st-left-dependencies"), require("./st-left-contours"), require("./st-structure"))
    : factory(root.STLeftDependencies, root.STLeftContours, root.STStructure);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.STLeftRoutes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (D, C, S) {
  "use strict";
  const contourKey = state => C.key(S.leftSurface.heights(state.board));
  const profiles = new Map(C.catalog.map(c => [c.id, c.key]));
  function prepare(state, options = {}) {
    // Do not pass inferred arrivals or any search-node supply to this lookup.
    const query = D.query(state, {
      resources: options.resources,
      centerDebt: options.centerDebt,
      center: options.center,
      right: options.right,
      allowHold: options.allowHold,
      allowIntervening: true,
      maxStates: options.maxStates,
    });
    const routes = [];
    for (const alternative of query.alternatives)
      for (const path of alternative.paths) {
        const id = [query.contour, alternative.pieces.join(""), ...path.contours].join(":");
        routes.push({
          id,
          pieces: alternative.pieces.slice(),
          contours: path.contours.slice(),
          stages: [contourKey(state), ...path.contours.map(id => profiles.get(id))],
        });
      }
    // The one feasible schedule is only an existence witness. Another actual
    // schedule may consume a different eligible public S/L of the same type.
    const resources = options.resources || {};
    const publicPieces = [
      [state.active?.type, resources.active],
      [state.hold, resources.hold],
      ...state.queue.map((type, i) => [type, resources.queue?.[i]]),
    ].filter(([type, p]) => type && p?.type === type).map(([, p]) => p);
    const eligibleIds = {};
    for (const type of ["S", "L"]) {
      const hanging = new Set((resources["hanging" + type] || []).map(p => p.id));
      eligibleIds[type] = publicPieces.filter(p => p?.type === type && p.id != null && hanging.has(p.id)).map(p => p.id);
    }
    const root = {
      routes,
      eligibleIds,
      query,
      stats: { queries: 1, complete: query.complete, status: query.status, routes: routes.length },
    };
    root.progress = start(root);
    return root;
  }
  function start(root) {
    return root.routes.map(route => ({ routeId: route.id, index: 0, complete: false }));
  }
  function advance(root, previous, before, placement, actualResource = null) {
    const event = placement?.event;
    // HOLD/movement does not lock and must never advance a dependency.
    if (!event || !Array.isArray(event.cells) || !event.cells.length) return previous;
    const from = contourKey(before), to = contourKey(placement.state);
    const touchesLeft = event.cells.some(([x]) => x >= 0 && x < 4);
    const routes = new Map(root.routes.map(route => [route.id, route]));
    const next = [];
    for (const progress of previous) {
      const route = routes.get(progress.routeId);
      if (!route) continue;
      // Completion is a historical fact, not a request to restart a cycle.
      if (progress.complete) { next.push(progress); continue; }
      if (from !== route.stages[progress.index]) continue;
      if (!touchesLeft) {
        if (from === to) next.push(progress);
        continue;
      }
      const type = route.pieces[progress.index];
      if (event.type !== type || to !== route.stages[progress.index + 1]) continue;
      if ((type === "S" || type === "L") &&
          (actualResource?.type !== type || !root.eligibleIds[type].includes(actualResource.id))) continue;
      const index = progress.index + 1;
      next.push({ routeId: route.id, index, complete: index === route.pieces.length });
    }
    return next;
  }
  function signatures(progress) {
    return progress.map(p => JSON.stringify([p.routeId, p.index, p.complete])).sort();
  }
  function key(progress) { return JSON.stringify(signatures(progress)); }
  function rank(progress) {
    return [progress.some(p => p.complete) ? 1 : 0,
      progress.length ? Math.max(...progress.map(p => p.index)) : -1];
  }
  // Comparator is deliberately separate from numeric structural scoring.
  function compare(a, b) {
    const ar = rank(a), br = rank(b);
    return br[0] - ar[0] || br[1] - ar[1];
  }
  return Object.freeze({ prepare, start, advance, signatures, key, rank, compare });
});
