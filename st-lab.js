/* Milestone lab owns a pure rules state. No legacy game globals or hidden queue
 * enter a planning request. Other practice pages retain their original engines. */
'use strict';
(() => {
  const workerURL='st-worker.js?v='+encodeURIComponent(STCoachConfig.ASSET_VERSION);
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const diagnostic=(error,context)=>window.STDiagnostics?.report(error,{pageBuild:'st-lab-diagnostics-2026-11-08-v1',...context});
  const workerDiagnostic=(data,context)=>window.STDiagnostics?.captureWorker(data,{pageBuild:'st-lab-diagnostics-2026-11-08-v1',...context});
  const diagnosticRequest=request=>window.STDiagnostics?.snapshotRequest(request);
  const workerFailure=event=>event?.error||{name:'WorkerError',message:event?.message||'Worker failed without error details.',stack:'',filename:event?.filename,lineno:event?.lineno,colno:event?.colno};
  const colors = {I:'#00bbee',J:'#3355ff',L:'#ff8800',O:'#ffee00',S:'#33cc55',T:'#bb55ee',Z:'#ff4444',X:'#999999','#':'#999999'};
  const defaults=['ArrowLeft','ArrowRight','ArrowDown','Space','ShiftLeft','KeyX','KeyZ','KeyC','KeyR','KeyT','KeyY','160','30','15','20','100'];
  let config;
  try { const saved=JSON.parse(localStorage.getItem('config')); config=Array.isArray(saved)&&saved.length>=16?saved:defaults; } catch { config=defaults; }
  const actions=['L','R','SD','HD','HOLD','CW','CCW','R180','RESET','UNDO'];
  const keys=Object.fromEntries(actions.map((action,i)=>[config[i],action]));
  const number=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
  const das=number(config[11],160,0,1000),arr=number(config[12],30,0,1000),sdr=number(config[13],15,1,1000);
  window.DAS=das; // shared settings/navigation readback; not a second game engine.
  window.ctrlsPopup=()=>window.open('controls.html','popup','width=1200,height=800');
  const context=$('b').getContext('2d');
  let suggestedFileName=STSession.DEFAULT_EXPORT_FILENAME;
  let state, origin, future=[], futureCursor=0, generated=false, privatePractice=false, openingPhase=false, openingClear=null, openingRepair=null, openingSource=null, patternHistory=null, obligationContext=null;
  let undoHistory=[], turnStart=null, inverseSession=null, pendingInverse=null, planContinuity=null, planProof=null;
  let tracking=STObligationTracking.create();const trackingListeners=new Map();
  function resetTracking(){tracking=STObligationTracking.create();for(const listener of trackingListeners.keys())trackingListeners.set(listener,tracking.subscribe(listener));}
  function accountingFrame(current=obligationContext,position=observation()){return{status:current.status,state:current.state,reason:current.reason,view:STObligationContext.resolve(current,{position})};}
  function adoptPlan(advice){const proof=advice?.evidence?.construction;if(!proof){planContinuity=null;planProof=null;return;}planContinuity=STPlanContinuity.importState(STPlanContinuity.exportState(planContinuity),{position:observation(),inventory:obligationContext.inventory,proof})||STPlanContinuity.start(observation(),obligationContext.inventory,proof);planProof=planContinuity?clone(proof):null;}
  function resources(){return{...STObligationContext.resolve(obligationContext,{position:observation()}),terminal:Boolean(state.topOut||!state.active)};}
  function resetInverse(){inverseSession=STObligationInverse.start(obligationContext,{requestEpoch:revision});pendingInverse=null;}
  function installTransition(prior,before,transition,operation,lock=lockCount){
    obligationContext=transition.context;
    // Current Context has already committed. Retain only changed before-images
    // in the caller's placement checkpoint, before observers/routing can fail.
    try{
      pendingInverse=STObligationInverse.record(inverseSession,{before:prior,after:obligationContext,requestEpoch:revision,compose:pendingInverse,...(operation.kind==='lock'?{piece:operation.piece}:{})}).receipt;
      if(operation.kind==='lock'){
        const saved=undoHistory.at(-1);saved.inverseReceipt=pendingInverse;saved.lockedPiece=clone(operation.piece);pendingInverse=null;
      }
    }catch(error){
      diagnostic(error,{operation:'inverse-update',stateRevision:state?.revision,transition:operation});
      // A failed Undo capability must never undo an accepted legal move or
      // replace its installed accounting. Start a fresh local Undo boundary;
      // old caller checkpoints cannot safely cross the missing inverse.
      undoHistory=[];turnStart=null;resetInverse();$('st-undo').disabled=true;
      setText($('st-game-status'),'Undo is unavailable for the preceding placements. The current position is unchanged.');
      throw error;
    }
    if(obligationContext.status==='available')patternHistory=clone(obligationContext.state.safety.notches);
    tracking.transition(accountingFrame(prior,before),accountingFrame(),{operation,effects:transition.effects,lock});
  }
  function markAccounting(kind){if(obligationContext.status!=='available'||kind==='handoff'&&obligationContext.state.sl.handoff||kind==='begin-reset'&&obligationContext.state.account.reset.status==='active')return;const prior=obligationContext,before=observation(),transition=kind==='handoff'?STObligationContext.handoff(prior,{position:before}):STObligationContext.beginReset(prior,{position:before,candidate:true});installTransition(prior,before,transition,{kind});}
  // Transient public-only forecast candidate. Never checkpoint or export it.
  let openingForecast=null;
  let worker=null, requestId=0, debounce=null, watchdog=null, revision=0;
  let result=null, previous=null, commitment=null, pendingLHint=null, coachStatus='idle', coachMessage='';
  // One actual-lock routing candidate, not a commitment or imported authority.
  let recoveryOrigin=null, recoveryExecution=null, pendingHandoffRecovery=null;
  let searchSettings=STSession.defaults();
  let selectedId=null, lockCount=0, clearedLines=0, lineLabel='Lines since start';
  const repeating=new Map();
  const fixtures=STFixtures.list || [];
  const modeKey='stLabMode',stableId='marathon-rebuild';
  const playModes=[{id:'empty',label:'Empty board'},{id:stableId,label:'Stable ST stack'}];
  function rememberMode(id){try{localStorage.setItem(modeKey,id);}catch{ /* Storage may be disabled; play still works. */ }}
  function chooseMode(id,{persist=true}={}){
    const mode=playModes.some(m=>m.id===id)?id:stableId;
    if(mode==='empty')empty();else loadFixture(stableId);
    importStatus('');
    if(persist)rememberMode(mode);
  }
  const profile=STRules.PROFILE.id || 'st-zero-v1';
  const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
  function importStatus(text,{rejected=false}={}) {
    const status=$('st-import-status'),input=$('st-snapshot');
    $('st-import-result').dataset.result=rejected?'rejected':'notice';
    for(const id of ['st-import-error-title','st-import-error-note','st-import-error-indicator'])$(id).hidden=!rejected;
    if(rejected)setText($('st-import-error-note'),'Your input and current game are unchanged.');
    status.setAttribute('role',rejected?'alert':'status');
    status.setAttribute('aria-live',rejected?'assertive':'polite');
    if(rejected){
      $('st-import-options').open=true;
      input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby','st-import-status');
      // Replace even identical text so a repeated failed attempt updates the live
      // region. Never interpret parser/validator messages as HTML or move focus.
      status.replaceChildren(document.createTextNode(text));
    }else{
      input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');
      setText(status,text);
    }
  }
  // Worker metadata is not markup or an unrestricted navigation destination.
  // Keep this exact allowlist independent of imported snapshots and planner data.
  const communitySourceURLs=new Set([
    'https://docs.google.com/document/d/1oqu0zqANYqorEf3tRpWuoMQ8FIJPWCi13uJSjgjrvbA/edit',
    'https://tl.net/forum/games/175252-10000-guide-tetris-ultra-st-stacking',
    'https://note.com/buri_daicon/n/n03a28dbfe045'
  ]);
  function renderSources(visible) {
    const container=$('st-sources'),list=$('st-source-list');
    list.replaceChildren();container.hidden=true;
    // Exact-witness retention keeps the recommendation status while a fresh
    // worker checks it. Error, ended-queue and other nonrecommendations do not.
    if(!visible || coachStatus!=='recommended-with-verified-prefix' || !result?.target || !Array.isArray(result.sources))return;
    const seen=new Set();
    for(const source of result.sources){
      if(!source || typeof source!=='object' || Array.isArray(source)
        || !['id','label','url','section','scope'].every(key=>typeof source[key]==='string'&&source[key].trim())
        || !communitySourceURLs.has(source.url) || seen.has(source.id))continue;
      seen.add(source.id);
      const item=document.createElement('li'),link=document.createElement('a');
      link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent=`${source.label} · ${source.section}`;link.title=source.scope;
      item.append(link);list.append(item);
    }
    container.hidden=!list.children.length;
  }
  const observation=()=>{
    const data={rules:state.rules,board:state.board.slice(),active:state.active?clone(state.active):null,
      hold:state.hold,canHold:state.canHold,queue:state.queue.slice(0,6),revision:state.revision,
      streamCursor:state.streamCursor || 0,topOut:Boolean(state.topOut)};
    if(state.bag) data.bag=clone(state.bag);
    return data;
  };
  function cancel() {
    clearTimeout(debounce); clearTimeout(watchdog);
    debounce=null;watchdog=null;
    if(worker)worker.terminate();worker=null;
  }
  function safeTarget(candidate) {
    if(!candidate?.target || !Array.isArray(candidate.witness) || !candidate.witness.length)return false;
    const replay=STRules.replay(observation(),candidate.witness);
    if(!replay.valid || replay.events.length!==1 || candidate.witness.at(-1)!=='HD')return false;
    if(Boolean(candidate.hold)!==candidate.witness.includes('HOLD'))return false;
    if(candidate.holdCount!==undefined&&candidate.holdCount!==candidate.witness.filter(a=>a==='HOLD').length)return false;
    const event=replay.events?.at(-1);
    if(!event?.target)return false;
    const a=event.target,b=candidate.target;
    return ['type','x','y','rotation'].every(key=>a[key]===b[key]);
  }
  // Both paths use the same public decision context. Capture has its own worker
  // and never installs advice, resource facts or gameplay state.
  function planningRequest(type,id) { return {type,id,observation:observation(),previous:previous?clone(previous):null,
          commitment:commitment?clone(commitment):null,
          options:{...(planContinuity?{planContinuity:STPlanContinuity.exportState(planContinuity)}:{}),...(openingForecast?{openingForecast:clone(openingForecast)}:{}),...(pendingLHint?{pendingLHint:clone(pendingLHint)}:{}),obligationContext:STObligationContext.exportState(obligationContext),...(pendingHandoffRecovery?{handoffRecovery:clone(pendingHandoffRecovery)}:{}),...searchSettings,patternHistory:patternHistory?clone(patternHistory):null,openingPhase,openingSource:openingSource?clone(openingSource):null,openingClear:openingClear?clone(openingClear):null,openingRepair:openingRepair?clone(openingRepair):null}}; }
  const workerWatchdogMs=2500; // Shared bound: 1500 ms search plus worker startup/transport allowance.
  let explorerWorker=null, explorerId=0, explorerWatchdog=null;
  function stopExplorer(message) {
    if(!explorerWorker)return;
    explorerWorker.terminate();explorerWorker=null;clearTimeout(explorerWatchdog);explorerWatchdog=null;
    $('st-explore-capture').disabled=false;$('st-explore-cancel').disabled=true;
    if(message)setText($('st-explore-status'),message);
  }
  function previewBoard(board,label) {
    const box=document.createElement('figure'),caption=document.createElement('figcaption'),grid=document.createElement('div');
    caption.textContent=label;grid.className='lab-explore-board';grid.setAttribute('role','img');
    const rows=Array.isArray(board)?board.filter(row=>typeof row==='string'&&row.length===10).slice(-22):[];
    grid.setAttribute('aria-label',label+'. Rows from top to bottom: '+rows.join(' / '));
    for(const row of rows)for(const cell of row){const square=document.createElement('span');square.setAttribute('aria-hidden','true');square.style.backgroundColor=colors[cell]||'#141414';grid.append(square);}
    box.append(caption,grid);return box;
  }
  function showExploration(trace,snapshot) {
    const list=$('st-explore-events');list.replaceChildren();
    const events=Array.isArray(trace?.events)?trace.events:[];
    let shownCount=0;
    const more=$('st-explore-more');
    const summary=trace?.result||{};
    const searchRoots=new Map((Array.isArray(trace?.searches)?trace.searches:[]).map(search=>[search.id,search]));
    function appendPage(){
      const shown=events.slice(shownCount,shownCount+200);shownCount+=shown.length;
      setText($('st-explore-status'),`Frozen revision ${snapshot.revision} · ${summary.status||'Capture complete'}${summary.reason?' · '+summary.reason:''}. Showing ${shownCount} of ${events.length} captured events${trace?.truncated?' (trace limit reached)':''}.`);
      for(const event of shown){
        const entry=document.createElement('details'),title=document.createElement('summary');
        const pieces=Array.isArray(event.path)?event.path.map(step=>step?.event?.target?.type||step?.event?.type||'').filter(piece=>/^[IJLOSTZ]$/.test(piece)).join(' → '):'';
        title.textContent=`${event.id??''} ${event.scope||'search'}${event.searchId!==undefined?' · search '+event.searchId:''} · ${event.kind||'event'}${event.depth!==undefined?' · depth '+event.depth:''}${event.outcome?' · '+String(event.outcome):''}${pieces?' · '+pieces:''}`;
        entry.append(title);
        // Build large detail content only when the user asks for this event.
        entry.addEventListener('toggle',()=>{if(!entry.open||entry.dataset.loaded)return;entry.dataset.loaded='true';
          const root=searchRoots.get(event.searchId);
          if(root?.observation){
            entry.append(previewBoard(root.observation.board,`Frozen search root ${root.id} · ${root.scope||event.scope||'search'}`));
            const context=document.createElement('pre');context.textContent=JSON.stringify({active:root.observation.active,hold:root.observation.hold,queue:root.observation.queue,canHold:root.observation.canHold},null,2);entry.append(context);
          }
          if(Array.isArray(event.board))entry.append(previewBoard(event.board,'Candidate board (after recorded path)'));
          const detail=document.createElement('pre');detail.textContent=JSON.stringify(event,null,2);entry.append(detail);
        });list.insertBefore(entry,detail);
      }
      more.hidden=shownCount>=events.length;more.textContent=`Show next ${Math.min(200,events.length-shownCount)} events`;
    }
    const detail=document.createElement('details'),title=document.createElement('summary'),pre=document.createElement('pre');
    title.textContent='Capture summary and scope';pre.textContent=JSON.stringify({...trace,events:undefined},null,2);detail.append(title,pre);list.append(detail);
    more.onclick=appendPage;appendPage();
  }
  function captureExploration() {
    if(explorerWorker)return;
    if(typeof Worker!=='function'){setText($('st-explore-status'),'Search capture is unavailable in this browser.');return;}
    const request=clone(planningRequest('explore',++explorerId)),snapshot=request.observation;
    const errorContext={operation:'explorer',requestId:request.id,request:diagnosticRequest(request)};
    $('st-explore-more').hidden=true;$('st-explore-more').onclick=null;
    $('st-explore-events').replaceChildren();$('st-explore-start').replaceChildren(previewBoard(snapshot.board,`Frozen starting board · revision ${snapshot.revision}`));
    const context=document.createElement('pre');context.textContent=JSON.stringify({active:snapshot.active,hold:snapshot.hold,queue:snapshot.queue,canHold:snapshot.canHold},null,2);$('st-explore-start').append(context);
    setText($('st-explore-status'),'Capturing one decision… The live game is unchanged.');
    try{
      const current=new Worker(workerURL);explorerWorker=current;
      $('st-explore-capture').disabled=true;$('st-explore-cancel').disabled=false;
      current.onmessage=({data})=>{
        if(explorerWorker!==current||state.revision!==snapshot.revision)return;
        const startupError=data?.type==='error'&&data.startupDiagnostic===true;
        if(!startupError&&(data?.id!==request.id||data.revision!==snapshot.revision))return;
        if(data.type!=='exploration'&&data.type!=='error')return;
        stopExplorer();
        if(data.type==='error'){workerDiagnostic(data,errorContext);setText($('st-explore-status'),'Capture failed. The live game is unchanged.');return;}
        showExploration(data.trace,snapshot);
      };
      current.onerror=event=>{if(explorerWorker!==current)return;diagnostic(workerFailure(event),{...errorContext,operation:'explorer-worker-error'});stopExplorer('Capture failed. The live game is unchanged.');};
      current.onmessageerror=()=>{if(explorerWorker!==current)return;diagnostic(new Error('Explorer worker response could not be deserialized.'),{...errorContext,operation:'explorer-messageerror'});stopExplorer('Capture failed. The live game is unchanged.');};
      current.postMessage(request);
      explorerWatchdog=setTimeout(()=>{if(explorerWorker===current)stopExplorer('Capture timed out. A valid continuation may still exist.');},workerWatchdogMs);
    }catch(error){diagnostic(error,{...errorContext,operation:'explorer-start-or-send'});stopExplorer();setText($('st-explore-status'),'Capture could not start. The live game is unchanged.');}
  }
  function requestPlan({retain=false}={}) {
    stopExplorer('Capture cancelled because the position or coaching context changed. Capture again to inspect this decision.');
    cancel();if(!retain)result=null;
    if(!TrainingSettings.guideVisible){coachStatus='hidden';coachMessage='';render();return;}
    if(state.topOut){coachStatus='top-out';coachMessage='This position has topped out. Undo the placement or reset to continue.';render();return;}
    if(!state.active){coachStatus='insufficient-known-pieces';coachMessage=privatePractice?'The supplied private practice sequence has ended. Reset to replay it or import another session.':'The supplied queue has ended. Import another snapshot or reset.';render();return;}
    if(typeof Worker!=='function'){result=null;planContinuity=null;planProof=null;coachStatus='worker-unavailable';coachMessage='Coaching is unavailable in this browser. You can still practice manually.';render();return;}
    if(!retain){coachStatus='thinking';coachMessage='Checking the next moves…';}render();
    const currentRevision=state.revision;
    // Input bursts settle briefly; only one worker is alive. Termination cancels
    // synchronous old searches instead of merely ignoring expensive stale work.
    debounce=setTimeout(()=>{
      debounce=null;
      const id=++requestId;
      let errorContext={operation:'coach-start',requestId:id};
      try {
        const request=planningRequest('plan',id);
        errorContext={operation:'coach',requestId:id,request:diagnosticRequest(request)};
        const activeWorker=new Worker(workerURL);worker=activeWorker;
        activeWorker.onmessage=({data})=>{
          if(worker!==activeWorker || currentRevision!==state.revision)return;
          const startupError=data?.type==='error'&&data.startupDiagnostic===true;
          if(!startupError&&(data?.id!==id||data.revision!==state.revision))return;
          clearTimeout(watchdog);watchdog=null;activeWorker.terminate();worker=null;
          if(data.type==='error'){workerDiagnostic(data,errorContext);recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;planContinuity=null;planProof=null;coachStatus='worker-error';coachMessage='The coach could not evaluate this position. You can still practice manually.';result=null;render();return;}
          if(data.type!=='result')return;
          try{
          const candidate=data.result;
          if(candidate?.target && !safeTarget(candidate)){
            recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;planContinuity=null;planProof=null;coachStatus='invalid-witness';coachMessage='The suggested move failed validation, so it is not shown.';result=null;render();return;
          }
          result=candidate || null;pendingHandoffRecovery=null;
          // Selected checked work owns a current deficit even if its plan is
          // later replaced. No goal is accepted from cached import labels.
          for(const repair of STLeftPlan.selectedRepairs(observation(),result,{checked:true})){
            if(obligationContext.status!=='available')break;
            const prior=obligationContext,before=observation(),transition=STObligationContext.acceptLeftRepair(prior,{position:before,repair,checked:true});
            installTransition(prior,before,transition,{kind:'accept-left-repair',repair,checked:true});
          }
          adoptPlan(result);
          openingForecast=STPlanner.captureOpeningForecast(observation(),result)||openingForecast;
          if(result?.target&&result.evidence?.strategy==='reset-coach')markAccounting('begin-reset');
          const recovery=STPlanner.captureHandoffRecovery(observation(),result,STObligationContext.exportState(obligationContext));
          // Revalidation during the same first piece must not replace the
          // pre-handoff origin with an already-marked mid-piece checkpoint.
          if(recovery){recoveryOrigin=recovery;recoveryExecution=STHandoffContinuity.start(observation(),obligationContext.inventory);}
          else if(!recoveryOrigin||result?.evidence?.openingHandoff?.recovery!=='shared-after-legacy-budget-miss'||JSON.stringify(result.target)!==JSON.stringify(recoveryOrigin.advice.target)){recoveryOrigin=null;recoveryExecution=null;}
          const wasOpening=openingPhase;const phase=STPlanner.acceptOpeningResult({active:openingPhase,clear:openingClear,repair:openingRepair,source:openingSource},result);openingPhase=phase.active;openingClear=phase.clear;openingRepair=phase.repair||null;openingSource=phase.source||null;
          if(!openingPhase)openingForecast=null;
          if(wasOpening&&!openingPhase){markAccounting('handoff');recoveryExecution=STHandoffContinuity.markHandoff(recoveryExecution,observation(),obligationContext.inventory);}
          coachStatus=result?.status || 'no-supported-continuation-found';
          coachMessage=result?.reason || 'No supported ST sequence was found within this search.';
          if(result?.target){
            previous={...clone(result),revision:state.revision};pendingLHint=result.evidence?.pendingLStage?clone(result.evidence.pendingLStage):null;

            commitment=result.recommendation?.kind!=='risky'&&!result.evidence?.opening&&(result.evidence?.strategy==='reset-coach'||STPlanner.resourceGoal(result.continuation||[]))?{observation:clone(observation()),advice:clone(result)}:null;
          }
          render();
          }catch(error){
            diagnostic(error,{...errorContext,operation:'coach-result'});
            // A selected-work, Reset or handoff marker may already be current.
            // Async result handling has no enclosing act() catch: keep those
            // facts and their inverse, retire only stale advice, then repaint.
            cancel();recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;openingForecast=null;planContinuity=null;planProof=null;result=null;previous=null;commitment=null;pendingLHint=null;
            coachStatus='interrupted';coachMessage='Coaching was interrupted. You can continue practicing from the current position.';
            try{if(obligationContext?.status==='available')patternHistory=clone(obligationContext.state.safety.notches);render();}catch(error){diagnostic(error,{operation:'recovery-render',stateRevision:state?.revision});}
          }
        };
        activeWorker.onerror=event=>{
          if(worker!==activeWorker)return;
          diagnostic(workerFailure(event),{...errorContext,operation:'coach-worker-error'});
          cancel();recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;planContinuity=null;planProof=null;coachStatus='worker-error';coachMessage='The coach could not start. You can still practice manually.';result=null;render();
        };
        activeWorker.onmessageerror=()=>{
          if(worker!==activeWorker)return;
          diagnostic(new Error('Coach worker response could not be deserialized.'),{...errorContext,operation:'coach-messageerror'});
          cancel();result=null;planContinuity=null;planProof=null;coachStatus='worker-error';coachMessage='The coach response could not be read. You can still practice manually.';render();
        };
        activeWorker.postMessage(request);
        watchdog=setTimeout(()=>{
          if(worker!==activeWorker)return;
          cancel();recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;result=null;planContinuity=null;planProof=null;coachStatus='budget-exhausted';coachMessage='The coach timed out. A valid continuation may still exist.';render();
        },workerWatchdogMs);
      } catch(error) {
        diagnostic(error,{...errorContext,operation:'coach-start-or-send'});
        cancel();recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;result=null;planContinuity=null;planProof=null;coachStatus='worker-unavailable';coachMessage='The coach could not start. You can still practice manually.';render();
      }
    },40);
  }
  function bag() {
    const pieces=['I','J','L','O','S','T','Z'];
    for(let i=pieces.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pieces[i],pieces[j]]=[pieces[j],pieces[i]];}
    return pieces;
  }
  function replenish() {
    const added=[];let frontier=state.bag;
    while(state.queue.length<6){
      if(futureCursor>=future.length){
        if(!generated){
          // A unique observable remainder is knowledge, not hidden lookahead.
          const forced=!privatePractice&&frontier?STBag.forcedNext(frontier):null;
          if(forced){state={...state,queue:[...state.queue,forced]};added.push(forced);frontier=STBag.consume(frontier,forced);}
          break;
        }
        future.push(...bag());
      }
      const type=future[futureCursor++];state={...state,queue:[...state.queue,type]};added.push(type);
      if(frontier)frontier=STBag.consume(frontier,type);
    }
    if(added.length&&frontier)state={...state,bag:frontier};
  }
  function resetState(input,{tail=[],random=false,history=null,note='',keepOrigin=false,opening=false,counterLabel='Lines since start',suggestedFileName:filename=STSession.DEFAULT_EXPORT_FILENAME}={}) {
    cancel();stopRepeating();planContinuity=null;planProof=null;recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;future=tail.slice();futureCursor=0;undoHistory=[];turnStart=null;generated=random;privatePractice=false;openingPhase=opening;openingClear=null;openingRepair=null;openingForecast=null;
    state=STRules.migrateState({...clone(input),revision:++revision});
    const errors=STRules.validate(state);if(errors.length)throw new Error(errors.join('; '));
    if(state.queue.length>6){future.unshift(...state.queue.slice(6));state={...state,queue:state.queue.slice(0,6)};}
    suggestedFileName=STSession.exportFilename(filename);
    // The initial finite history seeds knowledge once. Each actual public reveal
    // consumes the frontier; Undo already restores it in the state snapshot.
    if(history)state={...state,bag:STBag.fromObserved({observed:history,startPhase:0})};
    replenish();searchSettings=STSession.defaults();openingSource=STPlanner.startOpeningSession(observation(),{emptyMode:random&&opening}).source;patternHistory=STPlanner.startPatternHistory(observation());obligationContext=STObligationContext.start(observation(),{fresh:random&&opening});resetInverse();patternHistory=clone(obligationContext.state.safety.notches);resetTracking();previous=null;result=null;commitment=null;pendingLHint=null;lockCount=0;clearedLines=0;lineLabel=counterLabel;
    if(!keepOrigin)origin={input:clone(input),options:{tail:tail.slice(),random,history:history?.slice()||null,note,opening,counterLabel,suggestedFileName}};
    setText($('st-position-note'),note);setText($('st-game-status'),'');requestPlan();render();
  }
  function loadFixture(id) {
    const fixture=typeof STFixtures.get==='function'?STFixtures.get(id):clone(fixtures.find(f=>f.id===id));
    if(!fixture)throw new Error('Unknown fixture');
    selectedId=id;$('st-fixture').value=id;
    const input=fixture.observation || fixture.state;
    resetState(input,{tail:fixture.future||[],note:id===stableId?'Stable ST stack. Continue from the Independent rebuild position with a defined practice sequence.':`${fixture.label||fixture.name||id}. ${fixture.description||''} Preview/hold context is defined by this training fixture, not inferred from a recording.`});
  }
  function empty() {
    const initial=bag();selectedId='empty';$('st-fixture').value='empty';
    const active=initial.shift();
    resetState({rules:profile,board:STRules.emptyBoard(),active:{type:active,x:3,y:17,rotation:0,lastRotation:null},hold:null,canHold:true,queue:initial,streamCursor:1},
      {random:true,opening:true,history:[active,...initial],note:'Empty-board opening practice. The coach checks partial construction using visible pieces; completing the opening is not guaranteed.'});
  }
  function checkpoint() {
    return {state:clone(state),futureCursor,planContinuity:STPlanContinuity.exportState(planContinuity),planProof:planProof?clone(planProof):null,
      patternHistory:patternHistory?clone(patternHistory):null,openingPhase,openingSource:openingSource?clone(openingSource):null,openingClear:openingClear?clone(openingClear):null,openingRepair:openingRepair?clone(openingRepair):null,
      commitment:commitment?clone(commitment):null,pendingLHint:pendingLHint?clone(pendingLHint):null,lockCount,clearedLines};
  }
  function undo() {
    if(!undoHistory.length)return;
    cancel();stopRepeating();
    const saved=undoHistory.at(-1),restoredState={...clone(saved.state),revision:revision+1};
    // Include any accepted markers or partial next-turn input. Both receipts
    // remain usable if current-shape/position validation rejects the inverse.
    const restored=STObligationInverse.undo(inverseSession,obligationContext,{receipt:saved.inverseReceipt,piece:saved.lockedPiece,tail:pendingInverse,requestEpoch:restoredState.revision,restore:raw=>STObligationContext.importState(raw,{position:restoredState})});
    undoHistory.pop();state=restoredState;revision=state.revision;futureCursor=saved.futureCursor;pendingInverse=null;
    openingPhase=saved.openingPhase;openingSource=saved.openingSource?clone(saved.openingSource):null;openingClear=saved.openingClear?clone(saved.openingClear):null;openingRepair=saved.openingRepair?clone(saved.openingRepair):null;
    patternHistory=saved.patternHistory?clone(saved.patternHistory):null;obligationContext=restored.state;resetTracking();planProof=saved.planProof?clone(saved.planProof):null;planContinuity=planProof?STPlanContinuity.importState(saved.planContinuity,{position:observation(),inventory:obligationContext.inventory,proof:planProof}):null;
    commitment=saved.commitment?clone(saved.commitment):null;pendingLHint=saved.pendingLHint?clone(saved.pendingLHint):null;lockCount=saved.lockCount;clearedLines=saved.clearedLines;
    // Never resurrect displayed advice or an old worker response. The saved
    // proof is only a candidate for replay against this restored public state.
    previous=null;result=null;turnStart=null;recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;openingForecast=null;
    setText($('st-game-status'),`Placement undone. ${lockCount} piece${lockCount===1?'':'s'} locked.`);
    requestPlan();render();
  }
  function act(action) {
    try {
    if(action==='UNDO'){undo();return;}
    if(action==='RESET'){if(origin?.session){const saved=clone(origin.session);installSession(STSession.prepare(saved),origin.tail??null);}else if(origin)resetState(origin.input,{...origin.options,keepOrigin:true});return;}
    if(!state.active)return;
    const beforeAction=observation(),beforeLock=action==='HD'?beforeAction:null;
    const next=STRules.move(state,action);
    if(next===state)return;
    if(action!=='HD')pendingHandoffRecovery=null;
    if(!turnStart){
      // Markers accepted before this input are part of the new checkpoint's
      // baseline, but still reverse with the preceding completed placement.
      if(pendingInverse&&undoHistory.length){const saved=undoHistory.at(-1);saved.inverseReceipt=STObligationInverse.join(inverseSession,{receipt:saved.inverseReceipt,tail:pendingInverse}).receipt;}
      pendingInverse=null;turnStart=checkpoint();
    }
    const displayed=result;
    const locked=action==='HD';
    state={...next,revision:++revision};
    if(locked){undoHistory.push(turnStart);if(undoHistory.length>100)undoHistory.shift();turnStart=null;lockCount++;previous=null;
      const event=state.lastEvent;
      clearedLines+=event?.lines||0;
      setText($('st-game-status'),event?.topOut?'Top out. Undo the placement or reset to try again.':`${event?.lines||0} lines cleared${event?.spin&&event.spin!=='none'?` · ${event.spin} T-spin`:''}. ${lockCount} piece${lockCount===1?'':'s'} locked.`);
    }
    // Active movement does not expose pieces; only draws shorten the preview.
    replenish();
    const afterAction={...observation(),lastEvent:state.lastEvent},prior=obligationContext;
    // Context owns the one current inventory and creates exactly one genuine
    // receipt. Accepted gameplay still advances when accounting is unavailable.
    const transition=STObligationContext.applyActual(prior,{before:beforeAction,action,after:afterAction});
    const inventoryTransition=transition.receipt;
    installTransition(prior,beforeAction,transition,locked?{kind:'lock',piece:inventoryTransition.locked,event:state.lastEvent}:{kind:'observe'},locked?lockCount:lockCount+1);
    recoveryExecution=STHandoffContinuity.advance(recoveryExecution,beforeAction,action,afterAction,inventoryTransition);
    planContinuity=STPlanContinuity.advance(planContinuity,beforeAction,action,afterAction,inventoryTransition);
    if(openingForecast)openingForecast=STPlanner.advanceOpeningForecast(openingForecast,beforeAction,observation(),action);
    if(locked){
      const continuity=STHandoffContinuity.exportConnected(recoveryExecution);
      pendingHandoffRecovery=recoveryOrigin&&continuity?{...clone(recoveryOrigin),actualEvent:clone(state.lastEvent),continuity}:null;
      recoveryOrigin=null;recoveryExecution=null;
    }
    if(locked){
      if(obligationContext.status==='available')patternHistory=clone(obligationContext.state.safety.notches);
      if(openingPhase){const phase=STPlanner.updateOpeningSession({active:openingPhase,clear:openingClear,repair:openingRepair,source:openingSource},beforeLock,observation(),state.lastEvent,transition.effects);openingPhase=phase.active;openingClear=phase.clear;openingRepair=phase.repair||null;openingSource=phase.source||null;if(!openingPhase)pendingHandoffRecovery=null;}
      // Keep the proof's original public observation, not an input-history
      // guess. The planner checks that the actual lock matches its first step,
      // then replays the suffix using only the newly visible observation.
      const suffix=commitment&&typeof STPlanner.continueCommitment==='function'
        ?STPlanner.continueCommitment(commitment.observation,observation(),commitment.advice,state.lastEvent,{patternHistory,obligationContext:STObligationContext.exportState(obligationContext),planContinuity:STPlanContinuity.exportState(planContinuity)}):null;
      commitment=suffix?{observation:clone(observation()),advice:clone(suffix)}:null;adoptPlan(suffix);
    }
    if(!openingPhase)openingForecast=null;
    const advanced=!locked&&displayed?STPlanner.advance(observation(),displayed,action,{patternHistory,openingPhase,openingSource,obligationContext:STObligationContext.exportState(obligationContext),planContinuity:STPlanContinuity.exportState(planContinuity)}):null;
    if(advanced){result=advanced;previous=advanced;coachMessage=advanced.reason;coachStatus=advanced.status;}
    requestPlan({retain:Boolean(advanced)});render();
    } catch(error) {
      diagnostic(error,{operation:'play-action',action,requestId,stateRevision:state?.revision});
      stopExplorer('Capture cancelled because play was interrupted. Capture again to inspect the current position.');
      // An accepted action may already have installed its current Context.
      // Drop transient routing, never restart or reconstruct that authority.
      cancel();recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;openingForecast=null;planContinuity=null;planProof=null;result=null;previous=null;commitment=null;pendingLHint=null;
      coachStatus='interrupted';coachMessage='Coaching was interrupted. You can continue practicing from the current position.';
      // A late callback failure must not leave the old board or target visible.
      // Keep the original error if even the best-effort redraw fails.
      try{if(obligationContext?.status==='available')patternHistory=clone(obligationContext.state.safety.notches);render();}catch(error){diagnostic(error,{operation:'recovery-render',stateRevision:state?.revision});}
      throw error;
    }
  }
  function paintCell(ctx,x,y,type,size=20,outline=false) {
    ctx.fillStyle=colors[type]||'#999';ctx.strokeStyle=outline?'#aaa':'#222';ctx.lineWidth=outline?2:1;
    if(!outline)ctx.fillRect(x*size+1,y*size+1,size-2,size-2);
    ctx.strokeRect(x*size+1,y*size+1,size-2,size-2);
  }
  function miniature(id,types) {
    const ctx=$(id).getContext('2d');ctx.clearRect(0,0,$(id).width,$(id).height);
    types.forEach((type,index)=>{
      if(!type)return;
      STRules.cells({type,x:0,y:0,rotation:0}).forEach(([x,y])=>paintCell(ctx,x,y+index*4,type,15));
    });
  }
  function renderResourceBadge(id,status,label,reason,observedStatus,terminal,count=null,uncertain=null,anonymous=null) {
    const badge=$(id);
    // S/L counts remain observed facts even outside the reviewed strategy profile.
    const active=count===null?status===observedStatus:count>0;
    const displayStatus=count!==null&&active?observedStatus:status;
    if(badge.dataset.state!==displayStatus)badge.dataset.state=displayStatus;
    const observed=String(active);
    if(badge.dataset.observed!==observed)badge.dataset.observed=observed;
    $(id+'-piece').hidden=displayStatus==='out-of-profile';
    setText($(id+'-symbol'),displayStatus==='unknown'?'?':displayStatus==='out-of-profile'?'≠':'');
    if(count!==null)label+=`; confirmed count: ${count}`;
    if(uncertain>0)label+=`; unresolved accommodation: ${uncertain}${anonymous>0?`; anonymous count: ${anonymous}`:''}`;
    const detail=`${terminal?'Game ended; historical facts only. ':''}${label}. ${reason} Actual observed allocation, not a planned continuation.`;
    if(badge.getAttribute('aria-label')!==label)badge.setAttribute('aria-label',label);
    setText($(id+'-detail'),detail);
  }
  function render() {
    if(!state)return;
    const visible=TrainingSettings.guideVisible;
    // This names the session's coaching path, not search success or a local
    // scoring-wall phase. Reset progress includes qualifying actual player placements.
    const resetting=resources().reset?.status==='active';
    $('st-phase').dataset.phase=openingPhase?'opening':resetting?'reset':'maintenance';
    setText($('st-phase-name'),openingPhase?'Opening':resetting?'Reset':'Mid-game');
    setText($('st-phase-detail'),openingPhase?STOpeningObligations.checklist(obligationContext.status==='available'?obligationContext.state.account:null).map(item=>`${item.complete?'✅':'❌'} ${item.label}${item.progress?' ('+item.progress+')':''}`).join('\n'):'Coaching session, not a Reset classifier or resource allowance.');
    setText($('st-phase-symbol'),openingPhase?'◌':'▦');
    $('st-phase-indicator').hidden=false;
    $('st-undo').disabled=!undoHistory.length;
    const lineScope=lineLabel.replace('Lines ','');
    const lineTotal=clearedLines.toLocaleString('en-US'),pieceTotal=lockCount.toLocaleString('en-US');
    setText($('st-pieces-value'),pieceTotal);
    const pieceAnnouncement=`${pieceTotal} ${lockCount===1?'piece':'pieces'} locked${lineScope?' '+lineScope:''}`;
    if($('st-pieces').getAttribute('aria-label')!==pieceAnnouncement)$('st-pieces').setAttribute('aria-label',pieceAnnouncement);
    $('st-counters').classList.toggle('lab-counters-large',Math.max(lockCount,clearedLines)>=10000);
    setText($('st-lines-value'),lineTotal);
    setText($('st-lines-scope'),lineScope);$('st-lines-scope').hidden=!lineScope;
    const lineAnnouncement=`${lineTotal} ${clearedLines===1?'line':'lines'} cleared${lineScope?' '+lineScope:''}`;
    if($('st-lines').getAttribute('aria-label')!==lineAnnouncement)$('st-lines').setAttribute('aria-label',lineAnnouncement);
    const key=STBinding.resolve(localStorage,Object.keys(keys));
    setText($('st-toggle'),`Advice ${visible?'ON':'OFF'} · ${key||'rebind conflicting advice key'}`);
    $('st-toggle').setAttribute('aria-pressed',String(visible));
    $('st-status').hidden=!visible;$('st-diagnostics').hidden=!visible;
    if(visible){setText($('st-status'),`${coachMessage}`);$('st-status').dataset.result=coachStatus;}
    renderSources(visible);
    const currentResources=resources();
    const s=currentResources.hangingS||{status:'unknown',evidence:[],unclassifiedCount:null},l=currentResources.hangingL||{status:'unknown',evidence:[],unclassifiedCount:null},z=currentResources.extraZ||{status:'unknown',remaining:null};
    const sLabel={hanging:'observed surplus','none-observed':'none currently observed',unknown:'unknown current accounting','out-of-profile':'outside the reviewed source profile'}[s.status];
    const lLabel={hanging:'observed surplus','none-observed':'none currently observed',unknown:'unknown current accounting','out-of-profile':'outside the reviewed source profile'}[l.status];
    const zLabel=currentResources.reset?.status==='active'?(z.remaining===null?'Reset in progress; earlier Z balance unknown':`Reset in progress; observed balance ${z.remaining}${z.status==='out-of-profile'?'; outside the reviewed source profile':''}`):z.status==='available'&&z.remaining>1?`${z.remaining} remaining in the current balance`:{available:'available in the current account',used:'spent in the current account',unknown:'eligibility unknown','out-of-profile':'outside the reviewed source profile'}[z.status];
    renderResourceBadge('st-hanging-s',s.status,`Hanging S: ${sLabel}`,s.reason||currentResources.reason||'Current obligation facts.','hanging',currentResources.terminal,currentResources.status==='unavailable'?null:s.evidence.length,s.unclassifiedCount,s.aggregate?.reduce((a,b)=>a+b,0));
    renderResourceBadge('st-hanging-l',l.status,`Hanging L: ${lLabel}`,`${l.reason||currentResources.reason||'Current obligation facts.'} A normal Center SL awaiting its L is separate; no L repair strategy is implied.`,'hanging',currentResources.terminal,currentResources.status==='unavailable'?null:l.evidence.length,l.unclassifiedCount,l.aggregate?.reduce((a,b)=>a+b,0));
    renderResourceBadge('st-extra-z',z.status,`Extra Z: ${zLabel}`,z.reason||currentResources.reason||'Current obligation facts.','used',currentResources.terminal);
    $('st-resource-terminal').hidden=!currentResources.terminal;
    const centerLabel=currentResources.center?`${currentResources.center.pending.length} pending, ${currentResources.center.debt.length} diverted`:'unknown';
    setText($('st-resource-summary'),`${currentResources.terminal?'Game ended; historical facts only. ':''}Hanging S: ${sLabel}. Hanging L: ${lLabel}. Extra Z: ${zLabel}. Observed Center partners: ${centerLabel}. Unclassified S/L accommodation: ${s.unclassifiedCount??'?'}/${l.unclassifiedCount??'?'}; anonymous counts do not name pieces. These are diagnostics, not placement instructions.`);
    setText($('st-reset-summary'),currentResources.reset?.status==='active'?`Reset: ${currentResources.reset.progress} of 2 Left T placements completed. Remaining non-Right Z balance: ${z.remaining??'unknown'}.`:`Current Reset: ${currentResources.reset?.status??'unavailable'}.`);
    setText($('st-diagnostic-text'),JSON.stringify({status:coachStatus,revision:state.revision,resources:currentResources,
      ...(result?{metrics:result.metrics,evidence:result.evidence,horizon:result.horizon,continuation:result.continuation}:{}),
      note:'Only the shown sequence has been checked. Continued ST play is not guaranteed.'},null,2));
    context.clearRect(0,0,200,440);
    state.board.forEach((row,y)=>{if(y<18)return;[...row].forEach((type,x)=>{if(type!=='.')paintCell(context,x,y-18,type);});});
    if(state.active){
      let ghost=state;
      for(let i=0;i<40;i++){const next=STRules.move(ghost,'SD');if(next===ghost)break;ghost=next;}
      for(const [x,y] of STRules.cells(ghost.active))if(y>=18)paintCell(context,x,y-18,ghost.active.type,20,true);
      for(const [x,y] of STRules.cells(state.active))if(y>=18)paintCell(context,x,y-18,state.active.type);
    }
    miniature('h',[state.hold]);miniature('n',state.queue.slice(0,6));
    // The bag knowledge is at the *end* of visible preview. Only a unanimous
    // remainder size proves a boundary; unknown imports get no invented bars.
    const masks=state.bag?.remaining||[];
    const counts=[...new Set(masks.map(mask=>mask.toString(2).replace(/0/g,'').length))];
    if(TrainingSettings.bagBoundaries && counts.length===1){
      const phase=((7-counts[0]-state.queue.length)%7+7)%7;
      const next=$('n').getContext('2d');next.strokeStyle='#ccc';next.lineWidth=1;
      for(let i=0;i<state.queue.length;i++)if((phase+i)%7===0){
        next.beginPath();next.moveTo(0,Math.max(2,i*60-2));next.lineTo(90,Math.max(2,i*60-2));next.stroke();
      }
    }
    setText($('st-hold-state'),!state.topOut&&state.active&&(state.hold||state.queue.length)?'Unlimited swaps':'Unavailable');
    const target=$('st-target');target.replaceChildren();
    if(visible&&result?.target){for(const [x,y] of STRules.cells(result.target)){
      if(y<18)continue;const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
      for(const [name,value] of Object.entries({x:x*20+2,y:(y-18)*20+2,width:16,height:16,fill:'none',stroke:'#ffc85b','stroke-width':3}))rect.setAttribute(name,String(value));
      target.append(rect);
    }}
  }
  function stopRepeating(){for(const timer of repeating.values()){clearTimeout(timer.timeout);clearInterval(timer.interval);}repeating.clear();}
  function toggle(){TrainingSettings.setGuideVisible(!TrainingSettings.guideVisible);requestPlan();}
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||STBinding.textEntry(event.target)||event.target.closest?.('button,a,summary,[role="button"],.lab-phase'))return;
    const hintKey=STBinding.resolve(localStorage,Object.keys(keys));
    if(event.code===hintKey){event.preventDefault();if(!event.repeat)toggle();return;}
    const action=keys[event.code];if(!action)return;event.preventDefault();
    if(event.repeat||repeating.has(event.code))return;
    if(action==='RESET'){
      if(selectedId==='empty')empty();
      else if(origin?.session){act('RESET');return;}
      else if(origin){
        const initial=bag(),active=initial.shift();
        const input={...clone(origin.input),active:{type:active,x:3,y:17,rotation:0,lastRotation:null},queue:initial,streamCursor:1,topOut:false};
        delete input.bag;
        resetState(input,{random:true,history:[active,...initial],opening:origin.options.opening,counterLabel:origin.options.counterLabel,note:'Fresh random piece sequence from the starting position.'});
      }
    }else act(action);
    if(['L','R','SD'].includes(action)){
      const token={timeout:null,interval:null};repeating.set(event.code,token);
      const repeatStep=()=>{
        if(action!=='SD'&&arr===0){for(let i=0;i<10;i++)act(action);}else act(action);
      };
      token.timeout=setTimeout(()=>{repeatStep();token.interval=setInterval(repeatStep,action==='SD'?sdr:Math.max(10,arr));},action==='SD'?sdr:das);
    }
  });
  document.addEventListener('keyup',event=>{const token=repeating.get(event.code);if(token){clearTimeout(token.timeout);clearInterval(token.interval);repeating.delete(event.code);}});
  window.addEventListener('blur',stopRepeating);
  window.addEventListener('pagehide',()=>{stopRepeating();cancel();stopExplorer('Capture cancelled.');});
  window.addEventListener('storage',event=>{if(event.key==='stGuideVisible'||event.key===null)requestPlan();else if(event.key==='bagBoundaries')render();});
  document.querySelectorAll('.lab-phase [tabindex]').forEach(badge=>{
    for(const event of ['focus','mouseenter'])badge.addEventListener(event,()=>{delete badge.dataset.detailDismissed;});
    badge.addEventListener('keydown',event=>{if(event.code==='Escape')badge.dataset.detailDismissed='true';});
  });
  $('st-explore-capture').addEventListener('click',captureExploration);
  $('st-explore-cancel').addEventListener('click',()=>stopExplorer('Capture cancelled. No conclusion was reached.'));
  $('st-toggle').addEventListener('click',()=>{toggle();$('st-toggle').blur();});
  $('st-reset').addEventListener('click',()=>{act('RESET');$('st-reset').blur();});
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{act(button.dataset.action);button.blur();}));
  $('st-fixture').addEventListener('change',()=>{chooseMode($('st-fixture').value);$('st-fixture').blur();});
  function exportSession() {
    return STSession.create(observation(),{obligationContext,planContinuity:STPlanContinuity.exportState(planContinuity),patternHistory,openingPhase,openingSource,openingClear,openingRepair,previous,commitment,pendingLHint,search:searchSettings,suggestedFileName});
  }
  function installSession(prepared,tail=null) {
    // Normalize before mutation: Reset must restore the current checkpoint,
    // not an older envelope or discarded executable certificates.
    const envelope=STSession.create(prepared.state,prepared);
    // All current-shape and candidate checks have completed before touching the live
    // controller. Worker identity guards, not revision uniqueness, reject old replies.
    cancel();stopRepeating();recoveryOrigin=null;recoveryExecution=null;pendingHandoffRecovery=null;openingForecast=null;
    suggestedFileName=envelope.suggestedFileName;
    state=STRules.createState(prepared.state);revision=state.revision;
    future=tail?.slice()||[];futureCursor=0;generated=false;privatePractice=tail!==null;undoHistory=[];turnStart=null;
    obligationContext=prepared.obligationContext;resetInverse();resetTracking();
    patternHistory=prepared.patternHistory;
    openingPhase=prepared.openingPhase;openingSource=prepared.openingSource;openingClear=prepared.openingClear;openingRepair=prepared.openingRepair;
    previous=prepared.previous;commitment=prepared.commitment;planProof=clone(previous?.evidence?.construction||commitment?.advice?.evidence?.construction||null);planContinuity=planProof?STPlanContinuity.importState(prepared.planContinuity,{position:observation(),inventory:obligationContext.inventory,proof:planProof}):null;pendingLHint=prepared.pendingLHint;searchSettings=prepared.search;
    result=null;lockCount=0;clearedLines=0;lineLabel='Lines since import';selectedId=null;$('st-fixture').value='';
    origin={session:clone(envelope),tail:tail?.slice()??null};
    setText($('st-position-note'),privatePractice?'Imported coaching session with a finite private practice sequence. Only six preview pieces are shown to the coach. Restart restores this exact sequence; exports exclude the private tail.':'Imported coaching session. Only visible supply is restored; hidden future and Undo history are excluded.');
    setText($('st-game-status'),'');requestPlan();render();
    importStatus((privatePractice?'Private practice session imported.':'Session imported.')+' Advice will be revalidated.'+(prepared.warnings.length?' '+prepared.warnings.join(' '):''));
  }
  $('st-export-session').addEventListener('click',()=>{
    try{
      const session=exportSession(),text=JSON.stringify(session,null,2);
      const link=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      try{link.href=url;link.download=STSession.exportFilename(session.suggestedFileName);link.hidden=true;document.body.appendChild(link);link.click();}
      finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      importStatus('Download requested for the current coaching session. The browser controls the filename and save location; hidden future, Undo and diagnostic counters were excluded.');
    }
    catch(error){diagnostic(error,{operation:'session-export'});importStatus(`Session export unavailable: ${error.message}`);}
  });
  $('st-export').addEventListener('click',()=>{$('st-snapshot').value=JSON.stringify({...observation(),suggestedFileName},null,2);importStatus('Exported visible state only; hidden future was excluded.');});
  $('st-snapshot').addEventListener('input',()=>{
    if($('st-import-result').dataset.result==='rejected')setText($('st-import-error-note'),'Previous import attempt was rejected. Your edits have not been revalidated; the current game is unchanged.');
  });
  $('st-import').addEventListener('click',()=>{
    try{if($('st-snapshot').value.length>STSession.LIMITS.bytes)throw new Error('Import exceeds size limit.');const input=JSON.parse($('st-snapshot').value);if(input?.format===STPractice.FORMAT){const prepared=STPractice.prepare(input);installSession(prepared.session,prepared.tail);return;}if(input?.format===STSession.FORMAT){const prepared=STSession.prepare(input);installSession(prepared);return;}const errors=STRules.validate(input);if(errors.length)throw new Error(errors.join('; '));
      if(input.queue.length>6)throw new Error('Only six visible preview pieces may be imported; bag knowledge must refer to that frontier.');
      // Explicit whitelist prevents an import from injecting a hidden queue/seed.
      const clean={rules:input.rules,board:input.board,active:input.active,hold:input.hold,canHold:input.canHold,queue:input.queue.slice(0,6),streamCursor:input.streamCursor||0,topOut:Boolean(input.topOut)};
      if(input.bag){const bagErrors=STBag.validate(input.bag);if(bagErrors.length)throw new Error(bagErrors.join('; '));clean.bag=input.bag;}
      resetState(clean,{suggestedFileName:input.suggestedFileName,counterLabel:'Lines since import',opening:STPlanner.startOpeningSession(clean).active,note:'Imported visible snapshot. Missing bag history remains unknown; preview is finite.'});selectedId=null;$('st-fixture').value='';importStatus(input.rules===STRules.LEGACY_PROFILE.id?'Snapshot imported and migrated from v1 to unlimited-hold v2.':'Snapshot imported.');
    }catch(error){importStatus(`Import rejected: ${error.message}`,{rejected:true});}
  });
  for(const mode of playModes){const option=document.createElement('option');option.value=mode.id;option.textContent=mode.label;$('st-fixture').append(option);}
  setText($('st-key-help'),actions.map((action,i)=>`${config[i]}: ${action.toLowerCase()}`).join(' · ')+' · Set bindings in Game Settings.');
  window.stLab=Object.freeze({render,act,loadFixture,snapshot:()=>clone(observation()),exportSession:()=>clone(exportSession()),get publicInventory(){return STPublicInventory.exportState(obligationContext.inventory);},get obligationContext(){return STObligationContext.exportState(obligationContext);},onTrackingEvent(listener){trackingListeners.get(listener)?.();trackingListeners.set(listener,tracking.subscribe(listener));return()=>{trackingListeners.get(listener)?.();trackingListeners.delete(listener);};},get resources(){return resources();},get result(){return result?clone(result):null;}});
  let savedMode;try{savedMode=localStorage.getItem(modeKey);}catch{ /* Fall back to the stable stack. */ }
  chooseMode(savedMode,{persist:false});
  if(savedMode && !playModes.some(m=>m.id===savedMode))rememberMode(stableId);
})();
