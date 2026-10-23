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
  const actions=['L','R','SD','HD','HOLD','CW','CCW','R180','RESET'];
  const keys=Object.fromEntries(actions.map((action,i)=>[config[i],action]));
  const number=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
  const das=number(config[11],160,0,1000),arr=number(config[12],30,0,1000),sdr=number(config[13],15,1,1000);
  window.DAS=das; // shared settings/navigation readback; not a second game engine.
  window.ctrlsPopup=()=>window.open('controls.html','popup','width=1200,height=800');
  const context=$('b').getContext('2d');
  let state, origin, future=[], generated=false, observed=null;
  let worker=null, requestId=0, debounce=null, watchdog=null, revision=0;
  let result=null, previous=null, commitment=null, coachStatus='idle', coachMessage='';
  let selectedId=null, lockCount=0;
  const repeating=new Map();
  const fixtures=STFixtures.list || [];
  const profile=STRules.PROFILE.id || 'st-zero-v1';
  const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
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
    if(state.topOut){coachStatus='top-out';coachMessage='This position has topped out. Reset to continue.';render();return;}
    if(!state.active){coachStatus='insufficient-known-pieces';coachMessage='The supplied queue has ended. Import a new observed position or reset.';render();return;}
    if(typeof Worker!=='function'){coachStatus='worker-unavailable';coachMessage='Coaching requires Web Workers, which are unavailable here. Manual practice still works.';render();return;}
    if(!retain){coachStatus='thinking';coachMessage='Checking a continuation…';}render();
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
          if(data.type==='error'){coachStatus='worker-error';coachMessage='The coach could not evaluate this position. Manual practice is still available.';result=null;render();return;}
          if(data.type!=='result')return;
          const candidate=data.result;
          if(candidate?.target && !safeTarget(candidate)){
            coachStatus='invalid-witness';coachMessage='A suggested path failed validation and has been withheld.';result=null;render();return;
          }
          result=candidate || null;
          coachStatus=result?.status || 'no-supported-continuation-found';
          coachMessage=result?.reason || 'No supported ST continuation was established within the checked horizon.';
          if(result?.target){
            previous={...clone(result),revision:state.revision};
            const resources=STPlanner.cycleResources(result.continuation||[]);
            commitment=resources.tsds+resources.quads+resources.pocket+(resources.centerCompletions||0)>0?{observation:clone(observation()),advice:clone(result)}:null;
          }
          render();
        };
        activeWorker.onerror=event=>{
          event.preventDefault?.();
          if(worker!==activeWorker)return;
          cancel();coachStatus='worker-error';coachMessage='The coach worker could not start. Manual practice is still available.';result=null;render();
        };
        activeWorker.postMessage({type:'plan',id,observation:observation(),previous:previous?clone(previous):null,
          commitment:commitment?clone(commitment):null,
          options:{timeMs:750,depth:3,width:8,maxNodes:45000}});
        watchdog=setTimeout(()=>{
          if(worker!==activeWorker)return;
          cancel();result=null;coachStatus='budget-exhausted';coachMessage='The coach exceeded its response budget; no claim about impossibility is made.';render();
        },2500);
      } catch {
        cancel();coachStatus='worker-unavailable';coachMessage='The coach worker could not start. Manual practice is still available.';render();
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
      if(!future.length){
        if(!generated){
          // A unique observable remainder is knowledge, not hidden lookahead.
          const forced=frontier?STBag.forcedNext(frontier):null;
          if(forced){state={...state,queue:[...state.queue,forced]};added.push(forced);}
          break;
        }
        future.push(...bag());
      }
      const type=future.shift();state={...state,queue:[...state.queue,type]};added.push(type);
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
  function resetState(input,{tail=[],random=false,history=null,note='',keepOrigin=false}={}) {
    cancel();stopRepeating();future=tail.slice();generated=random;observed=history?.slice() || null;
    state=STRules.migrateState({...clone(input),revision:++revision});
    const errors=STRules.validate(state);if(errors.length)throw new Error(errors.join('; '));
    if(state.queue.length>6){future.unshift(...state.queue.slice(6));state={...state,queue:state.queue.slice(0,6)};}
    replenish();previous=null;result=null;commitment=null;lockCount=0;
    if(!keepOrigin)origin={input:clone(input),options:{tail:tail.slice(),random,history:history?.slice()||null,note}};
    setText($('st-position-note'),note);setText($('st-game-status'),'');requestPlan();render();
  }
  function loadFixture(id) {
    const fixture=typeof STFixtures.get==='function'?STFixtures.get(id):clone(fixtures.find(f=>f.id===id));
    if(!fixture)throw new Error('Unknown fixture');
    selectedId=id;$('st-fixture').value=id;
    const input=fixture.observation || fixture.state;
    resetState(input,{tail:fixture.future||[],note:`${fixture.label||fixture.name||id}. ${fixture.description||''} Preview/hold context is defined by this training fixture, not inferred from a recording.`});
  }
  function empty() {
    const initial=bag();selectedId=null;$('st-fixture').value='';
    const active=initial.shift();
    resetState({rules:profile,board:STRules.emptyBoard(),active:{type:active,x:3,y:17,rotation:0,lastRotation:null},hold:null,canHold:true,queue:initial,streamCursor:1},
      {random:true,history:[active,...initial],note:'Empty-board manual practice. Opening construction is outside this milestone’s coaching scope.'});
  }
  function act(action) {
    if(action==='RESET'){if(origin)resetState(origin.input,{...origin.options,keepOrigin:true});return;}
    if(!state.active)return;
    const next=STRules.move(state,action);
    if(next===state)return;
    const displayed=result;
    const locked=action==='HD';
    state={...next,revision:++revision};
    if(locked){lockCount++;previous=null;
      const event=state.lastEvent;
      setText($('st-game-status'),event?.topOut?'Top out. Reset to try again.':`${event?.lines||0} lines cleared${event?.spin&&event.spin!=='none'?` · ${event.spin} T-spin`:''}. ${lockCount} piece${lockCount===1?'':'s'} locked.`);
    }
    // Active movement does not expose pieces; only draws shorten the preview.
    replenish();
    if(locked){
      // Keep the proof's original public observation, not an input-history
      // guess. The planner checks that the actual lock matches its first step,
      // then replays the suffix using only the newly visible observation.
      const suffix=commitment&&typeof STPlanner.continueCommitment==='function'
        ?STPlanner.continueCommitment(commitment.observation,observation(),commitment.advice,state.lastEvent):null;
      commitment=suffix?{observation:clone(observation()),advice:clone(suffix)}:null;
    }
    const advanced=!locked&&displayed?STPlanner.advance(observation(),displayed,action):null;
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
  function render() {
    if(!state)return;
    const visible=TrainingSettings.guideVisible;
    const key=STBinding.resolve(localStorage,Object.keys(keys));
    setText($('st-toggle'),`Advice ${visible?'ON':'OFF'} · ${key||'rebind conflicting advice key'}`);
    $('st-toggle').setAttribute('aria-pressed',String(visible));
    $('st-status').hidden=!visible;$('st-diagnostics').hidden=!visible;
    if(visible){setText($('st-status'),`${coachMessage}`);$('st-status').dataset.result=coachStatus;}
    setText($('st-diagnostic-text'),JSON.stringify({status:coachStatus,revision:state.revision,
      ...(result?{metrics:result.metrics,evidence:result.evidence,horizon:result.horizon,continuation:result.continuation}:{}),
      note:'Finite checked evidence, not a guarantee of indefinite ST play.'},null,2));
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
    if(event.ctrlKey||event.metaKey||event.altKey||STBinding.textEntry(event.target)||event.target.closest?.('button,a,summary,[role="button"]'))return;
    const hintKey=STBinding.resolve(localStorage,Object.keys(keys));
    if(event.code===hintKey){event.preventDefault();if(!event.repeat)toggle();return;}
    const action=keys[event.code];if(!action)return;event.preventDefault();
    if(event.repeat||repeating.has(event.code))return;
    act(action);
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
  $('st-toggle').addEventListener('click',()=>{toggle();$('st-toggle').blur();});
  $('st-reset').addEventListener('click',()=>{act('RESET');$('st-reset').blur();});
  $('st-empty').addEventListener('click',()=>{empty();$('st-empty').blur();});
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{act(button.dataset.action);button.blur();}));
  $('st-fixture').addEventListener('change',()=>{if($('st-fixture').value)loadFixture($('st-fixture').value);$('st-fixture').blur();});
  $('st-export').addEventListener('click',()=>{$('st-snapshot').value=JSON.stringify(observation(),null,2);setText($('st-import-status'),'Exported visible state only; hidden future was excluded.');});
  $('st-import').addEventListener('click',()=>{
    try{const input=JSON.parse($('st-snapshot').value);const errors=STRules.validate(input);if(errors.length)throw new Error(errors.join('; '));
      if(input.queue.length>6)throw new Error('Only six visible preview pieces may be imported; bag knowledge must refer to that frontier.');
      // Explicit whitelist prevents an import from injecting a hidden queue/seed.
      const clean={rules:input.rules,board:input.board,active:input.active,hold:input.hold,canHold:input.canHold,queue:input.queue.slice(0,6),streamCursor:input.streamCursor||0,topOut:Boolean(input.topOut)};
      if(input.bag){const bagErrors=STBag.validate(input.bag);if(bagErrors.length)throw new Error(bagErrors.join('; '));clean.bag=input.bag;}
      resetState(clean,{note:'Imported visible snapshot. Missing bag history remains unknown; preview is finite.'});selectedId=null;$('st-fixture').value='';setText($('st-import-status'),input.rules===STRules.LEGACY_PROFILE.id?'Snapshot imported and migrated from v1 to unlimited-hold v2.':'Snapshot imported.');
    }catch(error){setText($('st-import-status'),`Import rejected: ${error.message}`);}
  });
  const blank=document.createElement('option');blank.value='';blank.textContent='Choose a position';$('st-fixture').append(blank);
  for(const fixture of fixtures){const option=document.createElement('option');option.value=fixture.id;option.textContent=(fixture.id==='o-before-double'?'Demo · ':'')+(fixture.label||fixture.name||fixture.id);$('st-fixture').append(option);}
  setText($('st-key-help'),actions.map((action,i)=>`${config[i]}: ${action.toLowerCase()}`).join(' · ')+' · Set bindings in Game Settings.');
  window.stLab=Object.freeze({render,act,loadFixture,snapshot:()=>clone(observation()),get result(){return result?clone(result):null;}});
  if(fixtures.length)loadFixture(fixtures.some(f=>f.id==='o-before-double')?'o-before-double':fixtures[0].id);else empty();
})();
