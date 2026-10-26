/* Milestone lab owns a pure rules state. No legacy game globals or hidden queue
 * enter a planning request. Other practice pages retain their original engines. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
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
  let state, origin, future=[], futureCursor=0, generated=false, observed=null, openingPhase=false, openingClear=null, openingRepair=null, openingSource=null, patternHistory=null, resourceHistory=null;
  let undoHistory=[], turnStart=null, resetDiagnosticCache=null;
  let worker=null, requestId=0, debounce=null, watchdog=null, revision=0;
  let result=null, previous=null, commitment=null, coachStatus='idle', coachMessage='';
  let selectedId=null, lockCount=0, clearedLines=0, lineLabel='Lines since start';
  const repeating=new Map();
  const fixtures=STFixtures.list || [];
  const modeKey='stLabMode',stableId='marathon-rebuild';
  const playModes=[{id:'empty',label:'Empty board'},{id:stableId,label:'Stable ST stack'}];
  function rememberMode(id){try{localStorage.setItem(modeKey,id);}catch{ /* Storage may be disabled; play still works. */ }}
  function chooseMode(id,{persist=true}={}){
    const mode=playModes.some(m=>m.id===id)?id:stableId;
    if(mode==='empty')empty();else loadFixture(stableId);
    setText($('st-import-status'),'');
    if(persist)rememberMode(mode);
  }
  const profile=STRules.PROFILE.id || 'st-zero-v1';
  const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
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
  function requestPlan({retain=false}={}) {
    cancel();if(!retain)result=null;
    if(!TrainingSettings.guideVisible){coachStatus='hidden';coachMessage='';render();return;}
    if(state.topOut){coachStatus='top-out';coachMessage='This position has topped out. Undo the placement or reset to continue.';render();return;}
    if(!state.active){coachStatus='insufficient-known-pieces';coachMessage='The supplied queue has ended. Import another snapshot or reset.';render();return;}
    if(typeof Worker!=='function'){result=null;coachStatus='worker-unavailable';coachMessage='Coaching is unavailable in this browser. You can still practice manually.';render();return;}
    if(!retain){coachStatus='thinking';coachMessage='Checking the next moves…';}render();
    const currentRevision=state.revision;
    // Input bursts settle briefly; only one worker is alive. Termination cancels
    // synchronous old searches instead of merely ignoring expensive stale work.
    debounce=setTimeout(()=>{
      debounce=null;
      const id=++requestId;
      try {
        const activeWorker=new Worker('st-worker.js');worker=activeWorker;
        activeWorker.onmessage=({data})=>{
          if(worker!==activeWorker || data?.id!==id || data.revision!==state.revision || currentRevision!==state.revision)return;
          clearTimeout(watchdog);watchdog=null;activeWorker.terminate();worker=null;
          if(data.type==='error'){coachStatus='worker-error';coachMessage='The coach could not evaluate this position. You can still practice manually.';result=null;render();return;}
          if(data.type!=='result')return;
          const candidate=data.result;
          if(candidate?.target && !safeTarget(candidate)){
            coachStatus='invalid-witness';coachMessage='The suggested move failed validation, so it is not shown.';result=null;render();return;
          }
          result=candidate || null;
          const wasOpening=openingPhase;const phase=STPlanner.acceptOpeningResult({active:openingPhase,clear:openingClear,repair:openingRepair,source:openingSource},result);openingPhase=phase.active;openingClear=phase.clear;openingRepair=phase.repair||null;openingSource=phase.source||null;
          if(wasOpening&&!openingPhase&&resourceHistory)resourceHistory=STResourceHistory.markHandoff(resourceHistory,observation());
          coachStatus=result?.status || 'no-supported-continuation-found';
          coachMessage=result?.reason || 'No supported ST sequence was found within this search.';
          if(result?.target){
            previous={...clone(result),revision:state.revision};

            commitment=!result.evidence?.opening&&STPlanner.resourceGoal(result.continuation||[])?{observation:clone(observation()),advice:clone(result)}:null;
          }
          render();
        };
        activeWorker.onerror=event=>{
          event.preventDefault?.();
          if(worker!==activeWorker)return;
          cancel();coachStatus='worker-error';coachMessage='The coach could not start. You can still practice manually.';result=null;render();
        };
        activeWorker.postMessage({type:'plan',id,observation:observation(),previous:previous?clone(previous):null,
          commitment:commitment?clone(commitment):null,
          options:{resourceContext:STResourceHistory.exportContext(observation(),resourceHistory),timeMs:1500,depth:3,width:8,maxNodes:45000,patternHistory:patternHistory?clone(patternHistory):null,openingPhase,openingSource:openingSource?clone(openingSource):null,openingClear:openingClear?clone(openingClear):null,openingRepair:openingRepair?clone(openingRepair):null}});
        watchdog=setTimeout(()=>{
          if(worker!==activeWorker)return;
          cancel();result=null;coachStatus='budget-exhausted';coachMessage='The coach timed out. A valid continuation may still exist.';render();
        },2500);
      } catch {
        cancel();result=null;coachStatus='worker-unavailable';coachMessage='The coach could not start. You can still practice manually.';render();
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
          const forced=frontier?STBag.forcedNext(frontier):null;
          if(forced){state={...state,queue:[...state.queue,forced]};added.push(forced);}
          break;
        }
        future.push(...bag());
      }
      const type=future[futureCursor++];state={...state,queue:[...state.queue,type]};added.push(type);
      if(frontier)frontier=STBag.consume(frontier,type);
    }
    if(observed){
      observed.push(...added);
      state={...state,bag:STBag.fromObserved({observed:observed.slice(),startPhase:0})};
    } else if(added.length && state.bag) {
      let knowledge=state.bag;for(const piece of added)knowledge=STBag.consume(knowledge,piece);
      state={...state,bag:knowledge};
    }
  }
  function resetState(input,{tail=[],random=false,history=null,note='',keepOrigin=false,opening=false,counterLabel='Lines since start'}={}) {
    cancel();stopRepeating();future=tail.slice();futureCursor=0;undoHistory=[];turnStart=null;generated=random;observed=history?.slice() || null;openingPhase=opening;openingClear=null;openingRepair=null;
    state=STRules.migrateState({...clone(input),revision:++revision});
    const errors=STRules.validate(state);if(errors.length)throw new Error(errors.join('; '));
    if(state.queue.length>6){future.unshift(...state.queue.slice(6));state={...state,queue:state.queue.slice(0,6)};}
    replenish();openingSource=STPlanner.startOpeningSession(observation(),{emptyMode:random&&opening}).source;patternHistory=STPlanner.startPatternHistory(observation());resourceHistory=STResourceHistory.start(observation(),{fresh:random&&opening});previous=null;result=null;commitment=null;lockCount=0;clearedLines=0;lineLabel=counterLabel;
    if(!keepOrigin)origin={input:clone(input),options:{tail:tail.slice(),random,history:history?.slice()||null,note,opening,counterLabel}};
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
      {random:true,opening:true,counterLabel:'Lines cleared',history:[active,...initial],note:'Empty-board opening practice. The coach checks partial construction using visible pieces; completing the opening is not guaranteed.'});
  }
  function checkpoint() {
    return {state:clone(state),futureCursor,observed:observed?.slice()||null,
      resourceHistory,patternHistory:patternHistory?clone(patternHistory):null,openingPhase,openingSource:openingSource?clone(openingSource):null,openingClear:openingClear?clone(openingClear):null,openingRepair:openingRepair?clone(openingRepair):null,
      commitment:commitment?clone(commitment):null,lockCount,clearedLines};
  }
  function undo() {
    if(!undoHistory.length)return;
    cancel();stopRepeating();
    const saved=undoHistory.pop();
    state={...clone(saved.state),revision:++revision};futureCursor=saved.futureCursor;
    observed=saved.observed?.slice()||null;openingPhase=saved.openingPhase;openingSource=saved.openingSource?clone(saved.openingSource):null;openingClear=saved.openingClear?clone(saved.openingClear):null;openingRepair=saved.openingRepair?clone(saved.openingRepair):null;
    patternHistory=saved.patternHistory?clone(saved.patternHistory):null;resourceHistory=saved.resourceHistory;
    commitment=saved.commitment?clone(saved.commitment):null;lockCount=saved.lockCount;clearedLines=saved.clearedLines;
    // Never resurrect displayed advice or an old worker response. The saved
    // proof is only a candidate for replay against this restored public state.
    previous=null;result=null;turnStart=null;
    setText($('st-game-status'),`Placement undone. ${lockCount} piece${lockCount===1?'':'s'} locked.`);
    requestPlan();render();
  }
  function act(action) {
    if(action==='UNDO'){undo();return;}
    if(action==='RESET'){if(origin)resetState(origin.input,{...origin.options,keepOrigin:true});return;}
    if(!state.active)return;
    const beforeAction=observation(),beforeLock=action==='HD'?beforeAction:null;
    const next=STRules.move(state,action);
    if(next===state)return;
    if(!turnStart)turnStart=checkpoint();
    const displayed=result;
    const locked=action==='HD';
    state={...next,revision:++revision};
    if(locked){undoHistory.push(turnStart);if(undoHistory.length>500)undoHistory.shift();turnStart=null;lockCount++;previous=null;
      const event=state.lastEvent;
      clearedLines+=event?.lines||0;
      setText($('st-game-status'),event?.topOut?'Top out. Undo the placement or reset to try again.':`${event?.lines||0} lines cleared${event?.spin&&event.spin!=='none'?` · ${event.spin} T-spin`:''}. ${lockCount} piece${lockCount===1?'':'s'} locked.`);
    }
    // Active movement does not expose pieces; only draws shorten the preview.
    replenish();
    resourceHistory=STResourceHistory.applyAction(resourceHistory,beforeAction,action,{...observation(),lastEvent:state.lastEvent});
    if(locked){
      patternHistory=STPlanner.updatePatternHistory(patternHistory,beforeLock,observation(),state.lastEvent);
      if(openingPhase){const phase=STPlanner.updateOpeningSession({active:openingPhase,clear:openingClear,repair:openingRepair,source:openingSource},beforeLock,observation(),state.lastEvent);openingPhase=phase.active;openingClear=phase.clear;openingRepair=phase.repair||null;openingSource=phase.source||null;}
      // Keep the proof's original public observation, not an input-history
      // guess. The planner checks that the actual lock matches its first step,
      // then replays the suffix using only the newly visible observation.
      const suffix=commitment&&typeof STPlanner.continueCommitment==='function'
        ?STPlanner.continueCommitment(commitment.observation,observation(),commitment.advice,state.lastEvent,{patternHistory,resourceContext:STResourceHistory.exportContext(observation(),resourceHistory)}):null;
      commitment=suffix?{observation:clone(observation()),advice:clone(suffix)}:null;
    }
    const advanced=!locked&&displayed?STPlanner.advance(observation(),displayed,action,{patternHistory,openingSource,resourceContext:STResourceHistory.exportContext(observation(),resourceHistory)}):null;
    if(advanced){result=advanced;previous=advanced;coachMessage=advanced.reason;coachStatus=advanced.status;}
    requestPlan({retain:Boolean(advanced)});render();
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
  function resetDiagnostics() {
    if(!resetDiagnosticCache||resetDiagnosticCache.state!==state||resetDiagnosticCache.history!==resourceHistory){
      resetDiagnosticCache={state,history:resourceHistory,value:STResetDiagnostics.resolve(observation(),resourceHistory)};
    }
    return resetDiagnosticCache.value;
  }
  function renderResourceBadge(id,status,label,reason,observedStatus,terminal) {
    const badge=$(id);
    if(badge.dataset.state!==status)badge.dataset.state=status;
    const observed=String(status===observedStatus);
    if(badge.dataset.observed!==observed)badge.dataset.observed=observed;
    $(id+'-piece').hidden=status==='out-of-profile';
    setText($(id+'-symbol'),status==='unknown'?'?':status==='out-of-profile'?'≠':'');
    const detail=`${terminal?'Game ended; historical facts only. ':''}${label}. ${reason} Actual observed allocation, not a planned continuation.`;
    if(badge.getAttribute('aria-label')!==label)badge.setAttribute('aria-label',label);
    setText($(id+'-detail'),detail);
  }
  function render() {
    if(!state)return;
    const visible=TrainingSettings.guideVisible;
    // This names the session's coaching path, not search success or a local
    // scoring-wall phase. A finite repair is not a detected community Reset.
    $('st-phase').dataset.phase=openingPhase?'opening':'maintenance';
    setText($('st-phase-name'),openingPhase?'Opening':'Mid-game');
    setText($('st-phase-symbol'),openingPhase?'◌':'▦');
    $('st-phase-indicator').hidden=false;
    $('st-undo').disabled=!undoHistory.length;
    setText($('st-lines'),`${lineLabel}: ${clearedLines}`);
    const key=STBinding.resolve(localStorage,Object.keys(keys));
    setText($('st-toggle'),`Advice ${visible?'ON':'OFF'} · ${key||'rebind conflicting advice key'}`);
    $('st-toggle').setAttribute('aria-pressed',String(visible));
    $('st-status').hidden=!visible;$('st-diagnostics').hidden=!visible;
    if(visible){setText($('st-status'),`${coachMessage}`);$('st-status').dataset.result=coachStatus;}
    renderSources(visible);
    const resources=STResourceHistory.resolve(observation(),resourceHistory);
    const sLabel={hanging:'observed surplus','none-observed':'none observed in the checked interval',unknown:'unknown history or allocation','out-of-profile':'outside the reviewed source profile'}[resources.hangingS.status];
    const lLabel={hanging:'observed surplus','none-observed':'none observed in the checked interval',unknown:'unknown history or allocation','out-of-profile':'outside the reviewed source profile'}[resources.hangingL.status];
    const zLabel={available:'unused in the verified interval',used:'used in the verified interval',unknown:'eligibility unknown','out-of-profile':'outside the reviewed source profile'}[resources.extraZ.status];
    renderResourceBadge('st-hanging-s',resources.hangingS.status,`Hanging S: ${sLabel}`,resources.hangingS.reason||resources.coverage.reason,'hanging',resources.terminal);
    renderResourceBadge('st-hanging-l',resources.hangingL.status,`Hanging L: ${lLabel}`,`${resources.hangingL.reason||resources.coverage.reason} A normal Center SL awaiting its L is separate; no L repair strategy is implied.`,'hanging',resources.terminal);
    renderResourceBadge('st-extra-z',resources.extraZ.status,`Extra Z: ${zLabel}`,resources.extraZ.reason||resources.coverage.reason,'used',resources.terminal);
    $('st-resource-terminal').hidden=!resources.terminal;
    const centerLabel=resources.center?`${resources.center.pending.length} pending, ${resources.center.debt.length} diverted`:'unknown';
    setText($('st-resource-summary'),`${resources.terminal?'Game ended; historical facts only. ':''}Hanging S: ${sLabel}. Hanging L: ${lLabel}. Extra Z: ${zLabel}. Observed Center partners: ${centerLabel}. These are diagnostics, not placement instructions.`);
    const resetEvidence=resetDiagnostics();
    const resetCount=resetEvidence.pairs.filter(p=>p.status==='reset-like-candidate').length;
    const resetLabel=resetCount?`${resetCount} Reset-like diversion pair(s) observed; exact phase boundaries remain uncertain.`:resetEvidence.status==='unknown'?'Earlier Reset history is unknown.':resetEvidence.status==='no-reset-evidence'?'No Reset evidence observed.':'Observed T diversions are insufficient to identify a Reset.';
    setText($('st-reset-summary'),`Reset evidence: ${resetLabel} No allowance is renewed and recommendations are unchanged.`);
    setText($('st-diagnostic-text'),JSON.stringify({status:coachStatus,revision:state.revision,resources,resetEvidence,
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
  window.addEventListener('pagehide',()=>{stopRepeating();cancel();});
  window.addEventListener('storage',event=>{if(event.key==='stGuideVisible'||event.key===null)requestPlan();else if(event.key==='bagBoundaries')render();});
  document.querySelectorAll('.lab-phase [tabindex]').forEach(badge=>{
    for(const event of ['focus','mouseenter'])badge.addEventListener(event,()=>{delete badge.dataset.detailDismissed;});
    badge.addEventListener('keydown',event=>{if(event.code==='Escape')badge.dataset.detailDismissed='true';});
  });
  $('st-toggle').addEventListener('click',()=>{toggle();$('st-toggle').blur();});
  $('st-reset').addEventListener('click',()=>{act('RESET');$('st-reset').blur();});
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{act(button.dataset.action);button.blur();}));
  $('st-fixture').addEventListener('change',()=>{chooseMode($('st-fixture').value);$('st-fixture').blur();});
  $('st-export').addEventListener('click',()=>{$('st-snapshot').value=JSON.stringify(observation(),null,2);setText($('st-import-status'),'Exported visible state only; hidden future was excluded.');});
  $('st-import').addEventListener('click',()=>{
    try{const input=JSON.parse($('st-snapshot').value);const errors=STRules.validate(input);if(errors.length)throw new Error(errors.join('; '));
      if(input.queue.length>6)throw new Error('Only six visible preview pieces may be imported; bag knowledge must refer to that frontier.');
      // Explicit whitelist prevents an import from injecting a hidden queue/seed.
      const clean={rules:input.rules,board:input.board,active:input.active,hold:input.hold,canHold:input.canHold,queue:input.queue.slice(0,6),streamCursor:input.streamCursor||0,topOut:Boolean(input.topOut)};
      if(input.bag){const bagErrors=STBag.validate(input.bag);if(bagErrors.length)throw new Error(bagErrors.join('; '));clean.bag=input.bag;}
      resetState(clean,{counterLabel:'Lines since import',opening:STPlanner.startOpeningSession(clean).active,note:'Imported visible snapshot. Missing bag history remains unknown; preview is finite.'});selectedId=null;$('st-fixture').value='';setText($('st-import-status'),input.rules===STRules.LEGACY_PROFILE.id?'Snapshot imported and migrated from v1 to unlimited-hold v2.':'Snapshot imported.');
    }catch(error){setText($('st-import-status'),`Import rejected: ${error.message}`);}
  });
  for(const mode of playModes){const option=document.createElement('option');option.value=mode.id;option.textContent=mode.label;$('st-fixture').append(option);}
  setText($('st-key-help'),actions.map((action,i)=>`${config[i]}: ${action.toLowerCase()}`).join(' · ')+' · Set bindings in Game Settings.');
  window.stLab=Object.freeze({render,act,loadFixture,snapshot:()=>clone(observation()),get resources(){return STResourceHistory.resolve(observation(),resourceHistory);},get resetEvidence(){return clone(resetDiagnostics());},get result(){return result?clone(result):null;}});
  let savedMode;try{savedMode=localStorage.getItem(modeKey);}catch{ /* Fall back to the stable stack. */ }
  chooseMode(savedMode,{persist:false});
  if(savedMode && !playModes.some(m=>m.id===savedMode))rememberMode(stableId);
})();
