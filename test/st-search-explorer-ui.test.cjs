function expectedDiagnostic(g,pattern,action){
 const original=g.window.console.error,entries=[];g.window.console.error=(...args)=>entries.push(args);
 try{action();}finally{g.window.console.error=original;}
 assert.ok(entries.length>0,'Expected exception logged');
 for(const entry of entries){assert.equal(entry[0],'[ZZTetris diagnostic]');assert.match(entry[1].error.message,pattern);}
}
const test=require('node:test');
const assert=require('node:assert/strict');
const {withPage}=require('./support/page.cjs');
const json=value=>JSON.parse(JSON.stringify(value));
function workers(g){
 const instances=[];
 g.window.Worker=class{
  constructor(){instances.push(this);this.terminated=false;}
  postMessage(message){this.message=json(message);}
  terminate(){this.terminated=true;}
  respond(trace,patch={}){this.onmessage({data:{type:'exploration',id:this.message.id,revision:this.message.observation.revision,trace,...patch}});}
 };
 g.click('#st-reset');g.advance(40);return instances;
}
test('st-explorer/opt-in: shared public context and frozen capture never apply a move',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),plan=ws[0],before=g.snapshot(),session=json(g.window.stLab.exportSession());
 assert.equal(ws.length,1);assert.equal(g.element('#st-explorer').open,false);
 assert.match(g.element('#st-explore-status').textContent,/No capture/);
 g.click('#st-explore-capture');const capture=ws.at(-1);
 assert.equal(capture.message.type,'explore');assert.equal(plan.terminated,false);
 assert.deepEqual(capture.message.options,plan.message.options);
 assert.deepEqual(capture.message.observation,before);assert.equal(capture.message.observation.queue.length,6);
 assert.equal('future' in capture.message,false);assert.equal('future' in capture.message.observation,false);
 g.click('#st-explore-capture');assert.equal(ws.length,2);
 capture.respond({events:[{id:1,scope:'ordinary',kind:'candidate',board:before.board,path:[{witness:['HD']}],priority:{rank:3},outcome:'beam-kept'}],result:{status:'budget-exhausted',reason:'Bounded search'}});
 assert.equal(capture.terminated,true);assert.deepEqual(g.snapshot(),before);assert.deepEqual(json(g.window.stLab.exportSession()),session);
 assert.equal(g.window.stLab.result,null);assert.match(g.element('#st-explore-status').textContent,/Frozen revision.*budget-exhausted/);
 const entry=g.element('#st-explore-events details');entry.open=true;entry.dispatchEvent(new g.window.Event('toggle'));
 assert.match(entry.textContent,/beam-kept/);assert.match(entry.querySelector('pre').textContent,/"witness"/);assert.equal(entry.querySelectorAll('.lab-explore-board span').length,220);
}));
test('st-explorer/cancellation: cancel, movement, same-revision imports and page exit reject late replies',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g),trace={events:[],result:{status:'late-result'}};
 g.click('#st-explore-capture');let old=ws.at(-1);g.click('#st-explore-cancel');assert.equal(old.terminated,true);old.respond(trace);assert.match(g.element('#st-explore-status').textContent,/cancelled/);
 g.click('#st-explore-capture');old=ws.at(-1);g.window.stLab.act('R');assert.equal(old.terminated,true);old.respond(trace);assert.doesNotMatch(g.element('#st-explore-status').textContent,/late-result/);
 g.click('#st-explore-capture');old=ws.at(-1);const session=g.window.stLab.exportSession();g.element('#st-snapshot').value=JSON.stringify(session);g.click('#st-import');assert.equal(old.terminated,true);old.respond(trace);assert.doesNotMatch(g.element('#st-explore-status').textContent,/late-result/);
 g.click('#st-explore-capture');old=ws.at(-1);g.window.dispatchEvent(new g.window.Event('pagehide'));assert.equal(old.terminated,true);old.respond(trace);assert.doesNotMatch(g.element('#st-explore-status').textContent,/late-result/);
}));
test('st-explorer/bounded safe details and request guards',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g);g.click('#st-explore-capture');const worker=ws.at(-1);
 const trace={events:Array.from({length:250},(_,i)=>({id:i,kind:'<img src=x onerror=alert(1)>',scope:'ordinary'})),truncated:true,result:{status:'complete'}};
 worker.respond(trace,{id:-1});assert.equal(worker.terminated,false);
 worker.respond(trace,{revision:-1});assert.equal(worker.terminated,false);
 worker.respond(trace);assert.equal(g.element('#st-explore-events').children.length,201);assert.equal(g.element('#st-explore-events').querySelector('img'),null);assert.match(g.element('#st-explore-status').textContent,/200 of 250.*limit reached/);
 assert.equal(g.element('#st-explore-more').hidden,false);g.click('#st-explore-more');assert.equal(g.element('#st-explore-events').children.length,251);assert.match(g.element('#st-explore-status').textContent,/250 of 250/);assert.equal(g.element('#st-explore-more').hidden,true);
 const finalEvent=g.element('#st-explore-events').children[249];finalEvent.open=true;finalEvent.dispatchEvent(new g.window.Event('toggle'));assert.equal(JSON.parse(finalEvent.querySelector('pre').textContent).id,249);
 g.click('#st-explore-capture');assert.equal(g.element('#st-explore-more').hidden,true);const fresh=ws.at(-1);worker.respond(trace);assert.equal(fresh.terminated,false);g.advance(2499);assert.equal(fresh.terminated,false);g.advance(1);assert.equal(fresh.terminated,true);assert.match(g.element('#st-explore-status').textContent,/timed out.*valid continuation/);
 g.click('#st-explore-capture');expectedDiagnostic(g,/Worker failed/,()=>ws.at(-1).onerror({preventDefault(){}}));assert.equal(g.element('#st-explore-capture').disabled,false);assert.match(g.element('#st-explore-status').textContent,/failed/);
}));

test('st-explorer/search roots: nested candidate previews its matching frozen root',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g);g.click('#st-explore-capture');const capture=ws.at(-1),snapshot=g.snapshot();
 const rootA={...snapshot,board:Array(40).fill('..........'),queue:['I']};
 const rootB={...snapshot,board:[...Array(39).fill('..........'),'TTT.......'],queue:['Z'],hold:'L'};
 capture.respond({searches:[{id:'root-a',scope:'ordinary',observation:rootA},{id:'root-b',scope:'handoff',observation:rootB}],events:[
  {id:1,searchId:'root-a',scope:'ordinary',kind:'candidate',board:rootA.board},
  {id:2,searchId:'root-b',scope:'handoff',kind:'candidate',board:snapshot.board}
 ],result:{status:'complete'}});
 const entries=g.element('#st-explore-events').querySelectorAll('details');
 entries[1].open=true;entries[1].dispatchEvent(new g.window.Event('toggle'));
 assert.match(entries[1].querySelector('summary').textContent,/search root-b/);
 const figures=entries[1].querySelectorAll('figure');assert.equal(figures.length,2);
 assert.equal(figures[0].querySelector('figcaption').textContent,'Frozen search root root-b · handoff');
 assert.match(figures[0].querySelector('[role="img"]').getAttribute('aria-label'),/TTT/);
 assert.match(figures[1].querySelector('figcaption').textContent,/Candidate board/);
 assert.deepEqual(JSON.parse(entries[1].querySelector('pre').textContent).queue,['Z']);
 assert.doesNotMatch(entries[1].textContent,/Frozen search root root-a/);
}));
test('st-explorer/interrupted action: cancel worker after position changes but accounting throws',()=>withPage('st-lab.html',{},g=>{
 const ws=workers(g);g.click('#st-explore-capture');const capture=ws.at(-1),before=g.snapshot();
 const original=g.window.STObligationContext;
 g.window.STObligationContext={...original,applyActual(){throw Error('Injected accounting interruption');}};
 try{expectedDiagnostic(g,/Injected accounting interruption/,()=>assert.throws(()=>g.window.stLab.act('R'),/Injected accounting interruption/));}finally{g.window.STObligationContext=original;}
 assert.notEqual(g.snapshot().revision,before.revision);assert.equal(capture.terminated,true);
 capture.respond({events:[],result:{status:'stale-result'}});
 assert.match(g.element('#st-explore-status').textContent,/cancelled.*interrupted/);
 assert.equal(g.element('#st-explore-capture').disabled,false);
}));
