'use strict';
// Final dispatcher results only. A successful recommendation can still have
// exhausted a search budget; abstention and exhaustion are independent axes.
function decision(advice, config = {}) {
  const evidence = advice?.evidence;
  const exhaustion = advice?.status === 'budget-exhausted' || evidence?.budgetExhausted === true
    ? 'reported' : evidence?.budgetExhausted === false ? 'not-reported' : 'unknown';
  return {
    disposition: advice?.target ? 'recommendation' : 'abstention',
    status: advice?.status ?? 'missing-result',
    exhaustion,
    searchIncomplete: evidence?.searchIncomplete === true,
    // Threshold observations are NOT causal stop reasons. Nested searches can
    // stop early, and dispatcher totals can include more than one sub-search.
    nodeLimitReached: Number.isFinite(config.maxNodes) && Number.isFinite(advice?.metrics?.nodes)
      ? advice.metrics.nodes >= config.maxNodes : null,
    timeLimitReached: Number.isFinite(config.timeMs) && Number.isFinite(advice?.metrics?.elapsedMs)
      ? advice.metrics.elapsedMs >= config.timeMs : null,
  };
}
function create() {
  return {schemaVersion: 1, decisions: 0, recommendation: {reported: 0, 'not-reported': 0, unknown: 0}, abstention: {reported: 0, 'not-reported': 0, unknown: 0}, searchIncomplete: 0, nodeLimitReached: 0, timeLimitReached: 0, nodeLimitUnknown: 0, timeLimitUnknown: 0, terminalDecision: null};
}
function add(counts, result) {
  counts.decisions++;
  counts[result.disposition][result.exhaustion]++;
  counts.searchIncomplete += Number(result.searchIncomplete);
  counts.nodeLimitReached += Number(result.nodeLimitReached === true);
  counts.timeLimitReached += Number(result.timeLimitReached === true);
  counts.nodeLimitUnknown += Number(result.nodeLimitReached === null);
  counts.timeLimitUnknown += Number(result.timeLimitReached === null);
  if (result.disposition === 'abstention') counts.terminalDecision = result;
  return result;
}
function terminal(summary) {
  if (summary.stop !== 'abstention') return summary.stop;
  if (summary.detail?.status === 'budget-exhausted') return 'abstention/reported';
  const exhaustion = summary.outcomes?.terminalDecision?.exhaustion;
  return 'abstention/' + (exhaustion ?? 'unknown');
}
function aggregate(episodes) {
  const result = {runs: episodes.length, terminal: {}, instrumentedRuns: 0, decisions: create()};
  for (const episode of episodes) {
    const key = terminal(episode);
    result.terminal[key] = (result.terminal[key] || 0) + 1;
    if (!episode.outcomes) continue; // Legacy or interrupted coverage is unknown, not zero.
    result.instrumentedRuns++;
    const o = episode.outcomes;
    for (const key of ['decisions', 'searchIncomplete', 'nodeLimitReached', 'timeLimitReached', 'nodeLimitUnknown', 'timeLimitUnknown']) result.decisions[key] += o[key];
    for (const kind of ['recommendation', 'abstention']) for (const budget of ['reported', 'not-reported', 'unknown']) result.decisions[kind][budget] += o[kind][budget];
  }
  return result;
}
function report(episodes) {
  const a = aggregate(episodes), d = a.decisions;
  return ['## Stop reasons and search budgets',
    `Terminal outcomes (${a.runs} runs): ${Object.entries(a.terminal).map(([k, v]) => `${k}: ${v}`).join('; ') || 'none'}.`,
    `Decision coverage: ${a.instrumentedRuns}/${a.runs} runs; ${d.decisions} returned dispatcher results (includes terminal abstentions).`,
    ...['recommendation', 'abstention'].map(k => `${k}: exhaustion reported ${d[k].reported}, not reported ${d[k]['not-reported']}, unknown ${d[k].unknown}.`),
    `Threshold observations: node limit reached ${d.nodeLimitReached} (${d.nodeLimitUnknown} unknown), time limit reached ${d.timeLimitReached} (${d.timeLimitUnknown} unknown); explicit search-incomplete ${d.searchIncomplete}. These overlap and do not identify the cause of stopping.`,
    'Not-reported means the final result explicitly reports no budget exhaustion, not exhaustive search or proof that no legal continuation exists. Nested proof/search caps can differ from outer limits. Missing instrumentation is unknown. Watchdogs, caps, errors and top-outs remain separate.'];
}
module.exports = {decision, create, add, terminal, aggregate, report};
