/* Free-play adapter for the ST lab. Only st-lab.html loads this file.
 * The engine owns play; STCore owns immutable rules/search. No hypothetical
 * actions are ever executed against the live board or zzBot.
 */
'use strict';
(() => {
  const advisor=STCore.create(pieces,kicksets['SRS+']);
  const $id=id=>document.getElementById(id);
  let cacheKey='', result=null;
  const lockedHeap=()=>board.map(row=>row.map(cell=>cell.t===1?'#':'.').join(''));
  function clear() {cacheKey='';result=null;$id('st-target').replaceChildren();delete $id('st-target').dataset.drawing;}
  // No phase/certificate sidecar: undo, imports, edits and ordinary locks all
  // receive the same fresh geometric analysis. Only visible preview enters it.
  function snapshot() {
    const next=STCore.visiblePreview(queue);
    return {heap:lockedHeap(),active:{id:'active',kind:piece,x:xPOS,y:yPOS,rotation:rot,lastAction},
      hold:holdP?{id:'hold',kind:holdP}:null,
      visibleNext:next?.map((kind,i)=>({id:'next-'+i,kind})),holdRule:'unlimited-swap',
      rules:{version:STCore.version,mode:'st-lab',kickset:kicks===kicksets['SRS+']?'SRS+':'unsupported',gravity:$id('grav').checked},
      limits:{maxPoseStates:30000,maxLockStates:128,depth:2}};
  }
  function advice() {
    const input=snapshot(), key=JSON.stringify(input);
    if(key!==cacheKey) {result=advisor.advise(input);cacheKey=key;}
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
    const answer=enabled?advice():null;
    let message;
    if(!enabled) message='Advice display off. Normal ghost and gameplay remain available.';
    else if(answer.kind==='target') {
      const prelude=answer.prelude.length===2 ? `HOLD TWICE · respawn ${answer.piece.kind}` : answer.prelude.length ? `HOLD FIRST · ${piece} → ${answer.piece.kind}` : `ACTIVE ${answer.piece.kind}`;
      message=`${prelude} · amber ST target for ${answer.piece.kind}. ${answer.explanation}`;
      message+=answer.continuationVerified ? ` A following ${answer.continuation.piece.kind} scoring action is also verified with legal access in the visible preview/hold.` : ' Immediate action only; no following scoring action verified.';
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
  window.stLab=Object.freeze({render,snapshot});
})();
