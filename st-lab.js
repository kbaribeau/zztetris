/* Free-play adapter for the ST lab. Only st-lab.html loads this file.
 * The engine owns play; STCore owns immutable rules/search. No hypothetical
 * actions are ever executed against the live board or zzBot.
 */
'use strict';
(() => {
  const advisor=STCore.create(pieces,kicksets['SRS+']);
  const $id=id=>document.getElementById(id);
  let cacheKey='', result=null, job=null, preferredTarget=null, started=0, decisionWorkMs=0, workUnits=0;
  const stats={decisions:0,cancelled:0,targetChurn:0,maxSliceMs:0,lastDecisionMs:0,lastWorkMs:0};
  let lastTarget='';
  const lockedHeap=()=>board.map(row=>row.map(cell=>cell.t===1?'#':'.').join(''));
  function clear() {
    if(job)stats.cancelled++;
    cacheKey='';result=null;job=null;preferredTarget=null;
    $id('st-target').replaceChildren();delete $id('st-target').dataset.drawing;
  }
  // No phase/certificate sidecar: undo, imports, edits and ordinary locks all
  // receive the same fresh geometric analysis. Only visible preview enters it.
  function snapshot() {
    const next=STCore.visiblePreview(queue);
    return {heap:lockedHeap(),active:{id:'active',kind:piece,x:xPOS,y:yPOS,rotation:rot,lastAction},
      hold:holdP?{id:'hold',kind:holdP}:null,
      visibleNext:next?.map((kind,i)=>({id:'next-'+i,kind})),holdRule:'unlimited-swap',
      rules:{version:STCore.version,mode:'st-lab',kickset:kicks===kicksets['SRS+']?'SRS+':'unsupported',gravity:$id('grav').checked},
      limits:{...STCore.limits}};
  }
  function advice() {
    const input=snapshot(), key=JSON.stringify(input);
    if(key!==cacheKey) {
      if(job)stats.cancelled++;
      job=advisor.start({...input,preferredTarget});cacheKey=key;
      result={kind:'pending',explanation:'Checking a three-lock ST continuation…'};
      started=performance.now();decisionWorkMs=0;workUnits=0;stats.decisions++;
    }
    if(job) {
      const begin=performance.now();
      // A measured synchronous stress decision took 44 ms. Bound each frame by
      // both work and elapsed time; no worker, hidden queue, or async callback.
      for(let work=0;work<16384;work++) {
        if(performance.now()-started>750) {
          job=null;result={kind:'abstain',reason:'time-exhausted',explanation:'Analysis time limit reached; no verified decision. This is not impossibility.',diagnostics:{stopReason:'adapter-deadline',requestedHorizon:3,effectiveHorizon:0,workUnits}};break;
        }
        const next=job.next();workUnits++;
        if(next.done){result=next.value;job=null;break;}
        if(performance.now()-begin>=4)break;
      }
      const elapsed=performance.now()-begin;decisionWorkMs+=elapsed;
      stats.maxSliceMs=Math.max(stats.maxSliceMs,elapsed);
      if(!job) {
        stats.lastDecisionMs=performance.now()-started;stats.lastWorkMs=decisionWorkMs;stats.lastWorkUnits=workUnits;
        if(result.kind==='target') {
          preferredTarget={kind:result.piece.kind,cells:result.cells};
          const targetKey=JSON.stringify(preferredTarget);
          if(lastTarget&&targetKey!==lastTarget)stats.targetChurn++;
          lastTarget=targetKey;
        } else preferredTarget=null;
      }
    }
    return result;
  }
  function toggle() {TrainingSettings.setGuideVisible(!TrainingSettings.guideVisible);}
  function render() {
    if(!window.zzBot) return;
    const enabled=TrainingSettings.guideVisible;
    const code=STBinding.resolve(localStorage,Object.keys(ctrl));
    const toggleLabel=`Advice ${enabled?'ON':'OFF'} · ${code || 'key conflicts; rebind in Game Settings'}`;
    if($id('st-toggle').textContent!==toggleLabel) $id('st-toggle').textContent=toggleLabel;
    if($id('st-toggle').getAttribute('aria-pressed')!==String(enabled)) $id('st-toggle').setAttribute('aria-pressed',String(enabled));
    if(!enabled&&(cacheKey||job))clear();
    const answer=enabled?advice():null;
    let message;
    if(!enabled) message='Advice display off. Normal ghost and gameplay remain available.';
    else if(answer.kind==='target') {
      const prelude=answer.prelude.length===2 ? `HOLD TWICE · respawn ${answer.piece.kind}` : answer.prelude.length ? `HOLD FIRST · ${piece} → ${answer.piece.kind}` : `ACTIVE ${answer.piece.kind}`;
      message=`${prelude} · amber ST target for ${answer.piece.kind}. ${answer.explanation}`;
      // The explanation describes a finite route, not necessarily a next score.
    } else message=answer.explanation;
    if($id('st-status').textContent!==message) $id('st-status').textContent=message;
    const resultLabel=answer?.kind==='abstain'?answer.reason:answer?.kind || 'off';
    if($id('st-status').dataset.result!==resultLabel) $id('st-status').dataset.result=resultLabel;
    const target=$id('st-target'), cells=answer?.kind==='target'?answer.cells:[];
    const drawingKey=JSON.stringify([cells,cellSize]);
    if(target.dataset.drawing!==drawingKey) {
      target.dataset.drawing=drawingKey;
      target.setAttribute('viewBox',`0 0 ${boardSize[0]*cellSize} ${(boardSize[1]-hiddenRows+2)*cellSize}`);
      target.style.width=boardSize[0]*cellSize+'px';
      target.style.height=(boardSize[1]-hiddenRows+2)*cellSize+'px';
      target.replaceChildren();
      for(const [x,y] of cells) {
        if(y<hiddenRows-2)continue;
        // Black backing + amber inset dashes: gray outer ghost remains visible.
        for(const backing of [true,false]) {
          const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
          rect.setAttribute('x',x*cellSize+cellSize*.22);
          rect.setAttribute('y',(y-hiddenRows+2)*cellSize+cellSize*.22);
          rect.setAttribute('width',cellSize*.56);rect.setAttribute('height',cellSize*.56);
          rect.setAttribute('fill','none');rect.setAttribute('stroke',backing?'#111':'#ffc85b');
          rect.setAttribute('stroke-width',Math.max(1,cellSize*(backing ? .18 : .1)));
          rect.setAttribute('stroke-dasharray',`${cellSize*.2} ${cellSize*.1}`);
          target.append(rect);
        }
      }
    }
  }
  $id('st-toggle').addEventListener('click',()=>{toggle();$id('st-toggle').blur();});
  // Capture text-entry keys before the legacy game listeners. Ordinary pages do
  // not load this adapter and retain their existing input behavior.
  document.addEventListener('keydown',event=>{
    if(STBinding.textEntry(event.target) || event.target.closest?.('button,a,summary,[role="button"]')) {event.stopImmediatePropagation();return;}
    if(ctrl[event.code] && !event.ctrlKey && !event.altKey && !event.metaKey) event.preventDefault();
    const code=STBinding.resolve(localStorage,Object.keys(ctrl));
    if(event.code===code && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();event.stopImmediatePropagation();
      if(!event.repeat)toggle();
    }
  },true);
  $id('grav').addEventListener('change',()=>{clear();render();});
  window.stLab=Object.freeze({render,snapshot,diagnostics:()=>JSON.parse(JSON.stringify({result,stats,pending:!!job}))});
})();
