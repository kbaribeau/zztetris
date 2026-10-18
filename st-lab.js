/* Practice adapter for the finite lab. Only st-lab.html loads this file.
 * The engine owns play; STCore owns immutable rules/search. No hypothetical
 * actions are ever executed against the live board or zzBot.
 */
'use strict';
(() => {
  const advisor=STCore.create(pieces,kicksets['SRS+']);
  const $id=id=>document.getElementById(id);
  const historyStates=new WeakMap();
  let strategy=null, observedEntry=null, observedSignature='';
  let cacheKey='', result=null;
  const lockedHeap=()=>board.map(row=>row.map(cell=>cell.t===1?'#':'.').join(''));
  const signature=entry=>entry ? JSON.stringify([entry.board,entry.queue,entry.hold,entry.piece]) : '';
  const clone=value=>value && JSON.parse(JSON.stringify(value));
  function clear() {cacheKey='';result=null;$id('st-target').replaceChildren();delete $id('st-target').dataset.drawing;}
  function observe() {observedEntry=hist[histPos];observedSignature=signature(observedEntry);}
  function syncHistory() {
    if(hist[histPos]!==observedEntry || signature(hist[histPos])!==observedSignature) {
      // Imports/full-mirror replace or mutate history outside undo/redo hooks.
      strategy=null;observe();clear();
    }
  }
  function snapshot() {
    syncHistory();
    const next=STCore.visiblePreview(queue);
    return {heap:lockedHeap(),active:{id:'active',kind:piece,x:xPOS,y:yPOS,rotation:rot,lastAction},
      hold:holdP?{id:'hold',kind:holdP}:null,
      visibleNext:next?.map((kind,i)=>({id:'next-'+i,kind})),holdRule:'unlimited-swap',strategy:clone(strategy),
      rules:{version:STCore.version,mode:'practice',kickset:kicks===kicksets['SRS+']?'SRS+':'unsupported',gravity:$id('grav').checked},
      limits:{maxPoseStates:30000,maxLockStates:128,depth:2}};
  }
  function saveHistory(entry) {
    historyStates.set(entry,{signature:signature(entry),strategy:clone(strategy)});
    observe();clear();
  }
  function restoreHistory(entry) {
    const record=historyStates.get(entry);
    strategy=record && record.signature===signature(entry) ? clone(record.strategy) : null;
    observe();clear();
  }
  function advice() {
    const input=snapshot(), key=JSON.stringify(input);
    if(key!==cacheKey) {result=advisor.advise(input);cacheKey=key;}
    return result;
  }
  function toggle() {TrainingSettings.setGuideVisible(!TrainingSettings.guideVisible);}
  function render() {
    if(!window.zzBot) return;
    syncHistory();
    const enabled=TrainingSettings.guideVisible;
    const code=STBinding.resolve(localStorage,Object.keys(ctrl));
    const toggleLabel=`Advice ${enabled?'ON':'OFF'} · ${code || 'key conflicts; rebind in Game Settings'}`;
    if($id('st-toggle').textContent!==toggleLabel) $id('st-toggle').textContent=toggleLabel;
    if($id('st-toggle').getAttribute('aria-pressed')!==String(enabled)) $id('st-toggle').setAttribute('aria-pressed',String(enabled));
    const answer=enabled?advice():null;
    let message;
    if(!enabled) message='Advice display off. Normal ghost and gameplay remain available.';
    else if(!strategy) message='Unsupported exercise state. Choose and explicitly start a named exercise; no board is loaded automatically.';
    else if(answer.kind==='target') {
      const prelude=answer.prelude.length===2 ? `HOLD TWICE · respawn ${answer.piece.kind}` : answer.prelude.length ? `HOLD FIRST · ${piece} → ${answer.piece.kind}` : `ACTIVE ${answer.piece.kind}`;
      message=`${prelude} · amber ST target for ${answer.piece.kind}. ${answer.explanation}`;
      if(!answer.continuationVerified) message+=' No further core step verified within the visible horizon.';
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
  function describe() {
    const ex=STCore.exercises.find(ex=>$id('st-exercise').value===ex.id);
    const setup=advisor.exercise(ex.id);
    $id('st-description').textContent=`${ex.description} Authored start: active ${setup.active}, hold ${setup.hold}, NEXT ${setup.next.join(' ')}. Start replaces this lab board, queue and history. Practice/SRS+, gravity off; no setup, filler, Reset/recovery or sustained-stacking coaching.`;
  }
  function start() {
    const setup=advisor.exercise($id('st-exercise').value);
    if(!setup || !window.zzBot)return;
    // This explicit button is the only operation that installs a drill. These
    // are temporary lab rules, never changes to normal-play saved preferences.
    $id('grav').checked=false;$id('kickset').value='SRS+';kicks=kicksets['SRS+'];
    keysDown=0;lastKeys=0;dasID++;
    board=setup.heap.map(row=>[...row].map(c=>({t:c==='#'?1:0,c:c==='#'?'X':''})));
    // A disclosed authored queue, not a bag prediction. Supply a finite tail to
    // render the initial preview; the planner sees only currently visible pieces.
    queue=[setup.active,...setup.next,...'IOTJLSZ|IOTJLSZ|'];
    holdP=setup.hold;held=false;lastAction='';combo=-1;b2b=-1;oldcombo=-1;oldb2b=-1;
    newPiece();
    hist=[{board:JSON.stringify(board),queue:JSON.stringify(queue),hold:holdP,piece}];histPos=0;
    strategy=clone(setup.strategy);saveHistory(hist[0]);render();
    $id('st-start').blur();
  }
  for(const ex of STCore.exercises) {
    const option=document.createElement('option');option.value=ex.id;option.textContent=ex.title;$id('st-exercise').append(option);
  }
  $id('st-exercise').addEventListener('change',describe);
  $id('st-start').addEventListener('click',start);
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
  window.stLab=Object.freeze({
    render,saveHistory,restoreHistory,
    beforeLock:snapshot,
    afterLock(input,lock) {strategy=advisor.advance(input,{...lock,heap:lockedHeap()});clear();},
    reset() {strategy=null;observe();clear();},
  });
  describe();
})();
