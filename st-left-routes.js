/* Root-only finite Left routes. Lookup supply is necessary, not a movement or
 * admission proof. Progress is earned only by the planner's emitted locks. */
(function (root, factory) {
  const api = typeof module === "object" && module.exports
    ? factory(require("./st-left-dependencies"), require("./st-left-contours"), require("./st-structure"), require("./st-rules"))
    : factory(root.STLeftDependencies, root.STLeftContours, root.STStructure, root.STRules);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.STLeftRoutes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (D, C, S, R) {
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
  // Geometry selects possible destinations only. No synthetic pose below is
  // returned as playable: targetedPlacements must replay a real input witness.
  // Support-cell candidates include buried tucks, not only skyline hard drops.
  function landingTargets(state, accept, options = {}) {
    const now = options.now || (() => Date.now()), deadline = options.deadline ?? Infinity;
    const maxNodes = options.maxNodes ?? Infinity, targets = [];
    let visited = 0;
    const types = new Set([state.active?.type]);
    if (options.allowHold !== false) {
      let current = state;
      for (let i = 0; i < 2; i++) {
        const next = R.move(current, "HOLD");
        if (next === current || next.topOut) break;
        types.add(next.active?.type); current = next;
      }
    }
    const spawn = state.active && R.spawn(state.active.type);
    const fresh = spawn && ["x", "y", "rotation"].every(k => state.active[k] === spawn[k]);
    // Fresh-spawn templates cannot exhaust the options of an already moved
    // active piece below/beyond an obstacle. Keep the generic inventory there.
    const center = options.centerTemplates && fresh ? S.centerTargets(state.board, options.notches) : null;
    if (center) for (const target of center) {
      if (!types.has(target.type) || options.types && !options.types.includes(target.type)) continue;
      if (visited >= maxNodes || now() >= deadline) return { targets, visited, complete: false };
      visited++;
      const played = R.replay(R.createState({ board: state.board, active: target.type, canHold: false }), target.witness);
      if (played.valid && played.events.length === 1 && accept({ state: played.state, event: played.events[0] }))
        targets.push({ ...target, centerTemplate: true });
    }
    const supports = Array.from({ length: 10 }, (_, x) =>
      [40, ...state.board.flatMap((row, y) => row[x] !== "." && (y === 0 || state.board[y - 1][x] === ".") ? [y] : [])]);
    for (const type of types) {
      if (!type || options.types && !options.types.includes(type)) continue;
      for (let rotation = 0; rotation < 4; rotation++) {
        const offsets = R.cells({ type, x: 0, y: 0, rotation });
        const lo = Math.min(...offsets.map(c => c[0])), hi = Math.max(...offsets.map(c => c[0]));
        // Only a bottommost mino in a shape column can contact its support.
        const bottom = offsets.filter(([dx, dy]) => !offsets.some(([x, y]) => x === dx && y > dy));
        for (let x = -lo; x < 10 - hi; x++) {
          // Canonical Center has a finite construction grammar. Cross-region
          // placements and unknown Center shapes keep the ordinary inventory.
          if (center && x + lo >= 4 && x + hi <= 6) continue;
          const ys = new Set(bottom.flatMap(([dx, dy]) => supports[x + dx].map(y => y - dy - 1)));
          for (const y of ys) {
            if (visited >= maxNodes || now() >= deadline) return { targets, visited, complete: false };
            visited++;
            const pose = { type, x, y, rotation, lastRotation: null };
            if (!R.fits(state.board, pose)) continue;
            const spins = [{ spin: "none", rotation: null }];
            if (type === "T") {
              const evidence = { from: (rotation + 3) % 4, to: rotation, kickIndex: 0 };
              const classified = R.spin(state.board, { ...pose, lastRotation: evidence });
              if (classified !== "none") spins.push({ spin: classified, rotation: evidence });
              if (classified === "mini") spins.push({ spin: "full", rotation: { ...evidence, kickIndex: 4 } });
            }
            for (const variant of spins) {
              // This is geometry, not a particular HOLD/supply outcome. An empty
              // queue avoids rejecting a held-piece landing because the original
              // queue's (already consumed) head would collide at next spawn.
              // Actual supply and spawn safety are checked by the replayed witness.
              const after = R.move({ ...state, queue: [], active: { ...pose, lastRotation: variant.rotation } }, "HD");
              if (!after.lastEvent || after.topOut || !accept({ state: after, event: after.lastEvent })) continue;
              targets.push({ type, x, y, rotation, spin: variant.spin });
            }
          }
        }
      }
    }
    return { targets, visited, complete: true };
  }
  function permits(root, progress, before, placement) {
    // Resource-identity filtering remains in advance after a witnessed lock.
    // This prefilter must be a superset of all progress-preserving landings.
    const from = contourKey(before), to = contourKey(placement.state), e = placement.event;
    if (progress.some(p => p.complete)) return true;
    return progress.some(p => {
      const route = root.routes.find(r => r.id === p.routeId);
      if (!route || route.stages[p.index] !== from) return false;
      return e.cells.every(([x]) => x >= 4) ? from === to :
        e.type === route.pieces[p.index] && to === route.stages[p.index + 1];
    });
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
  return Object.freeze({ prepare, start, advance, landingTargets, permits, signatures, key, rank, compare });
});
