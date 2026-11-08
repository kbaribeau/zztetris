/* Local-only exception diagnostics. No network, gameplay history or hidden supply. */
(function(root){
  'use strict';
  const BUILD='st-local-diagnostics-2026-11-08-v1',KEY='zztetris.st.diagnostics.v1';
  function create(host={}) {
    const MAX_RECORDS=12,MAX_BYTES=240000,MAX_RECORD=60000;
    let records=[],listeners=[],busy=false,serial=0;
    const read=(obj,key)=>{try{return obj?.[key];}catch{return '[unreadable]';}};
    const safeString=(value,fallback='[unprintable]')=>{try{return String(value);}catch{return fallback;}};
    const redactURLs=text=>text.replace(/https?:\/\/[^\s<>"']+/g,url=>url.replace(/[?#].*$/,''));
    function clean(value,depth=0,seen=new Set(),budget={left:10000,chars:50000}) {
      if(--budget.left<0)return '[truncated]';
      if(value===null||typeof value==='boolean')return value;
      if(typeof value==='number')return Number.isFinite(value)?value:String(value);
      if(typeof value==='string'){const text=redactURLs(value).slice(0,Math.max(0,Math.min(8000,budget.chars)));budget.chars-=text.length;return text|| (value?'[truncated]':'');}
      if(typeof value==='undefined')return null;
      if(typeof value!=='object')return safeString(value).slice(0,200);
      if(depth>14)return '[depth limit]';
      if(seen.has(value))return '[circular]';seen.add(value);
      let out;
      if(Array.isArray(value))out=value.slice(0,500).map(v=>clean(v,depth+1,seen,budget));
      else {out={};let keys;try{keys=Object.keys(value).slice(0,120);}catch{return '[unreadable]';}
        for(const k of keys){if(/^(cookie|password|token|secret|authorization|localStorage|sessionStorage|innerHTML)$/i.test(k))continue;
          const d=Object.getOwnPropertyDescriptor(value,k);out[k]=d&&'value'in d?clean(d.value,depth+1,seen,budget):'[accessor omitted]';}}
      seen.delete(value);return out;
    }
    // This boundary is deliberately explicit: never accept an entire game state,
    // storage dump or privatePractice future supply as diagnostics context.
    function snapshotRequest(request){
      if(!request||typeof request!=='object')return null;
      const observation=read(request,'observation')||{},obs={};
      for(const k of ['rules','board','active','hold','canHold','revision','streamCursor','topOut','bag'])obs[k]=read(observation,k);
      obs.queue=Array.isArray(read(observation,'queue'))?observation.queue.slice(0,6):[];
      return clean({type:read(request,'type'),id:read(request,'id'),observation:obs,
        previous:read(request,'previous'),commitment:read(request,'commitment'),options:read(request,'options')});
    }
    function serializeError(error,depth=0){
      const out={name:safeString(read(error,'name')||'Error').slice(0,200),message:redactURLs(safeString(read(error,'message')??error??'Unknown error')).slice(0,8000)};
      const stack=read(error,'stack');if(typeof stack==='string')out.stack=redactURLs(stack).slice(0,16000);
      const cause=read(error,'cause');if(cause!==undefined&&depth<3)out.cause=serializeError(cause,depth+1);
      return out;
    }
    const now=()=>new Date().toISOString();
    function persist(){try{host.localStorage?.setItem(KEY,JSON.stringify(records));}catch{/* memory/export remain available */}}
    function emit(){for(const fn of listeners)try{fn();}catch{/* reporting cannot break recovery */}}
    function limit(){while(records.length>MAX_RECORDS||JSON.stringify(records).length>MAX_BYTES)records.shift();}
    try{const saved=JSON.parse(host.localStorage?.getItem(KEY)||'[]');if(Array.isArray(saved))records=saved.slice(-MAX_RECORDS).filter(r=>r&&r.schemaVersion===1&&r.error&&typeof r.error.message==='string').map(r=>clean(r));limit();}catch{}
    function report(error,context={}){
      if(busy)return null;busy=true;
      try{
        const record={schemaVersion:1,id:Date.now().toString(36)+'-'+(++serial),timestamp:now(),lastSeen:now(),count:1,
          build:BUILD,browser:safeString(read(host.navigator,'userAgent')||'unknown').slice(0,500),error:serializeError(error),context:clean(context)};
        if(record.context?.request)record.context.request=snapshotRequest(context.request);
        if(JSON.stringify(record).length>MAX_RECORD){record.context={operation:record.context?.operation,requestId:record.context?.requestId,truncated:true};}
        const previous=records.at(-1);
        if(previous&&previous.error.message===record.error.message&&previous.error.stack===record.error.stack&&JSON.stringify(previous.context)===JSON.stringify(record.context)){
          previous.count=(previous.count||1)+1;previous.lastSeen=record.timestamp;
        }else records.push(record);
        limit();persist();
        try{host.console?.error('[ZZTetris diagnostic]',record);}catch{}
        emit();return clean(records.at(-1));
      }catch{return null;}finally{busy=false;}
    }
    function captureWorker(data,context={}) {return report(data?.error||{name:'WorkerError',message:data?.message||'Worker failed'},
      {...context,workerBuild:data?.diagnosticBuild||'unknown',workerStage:data?.stage||'unknown'});}
    function install(target=host,context={}){
      if(!target.addEventListener)return;
      target.addEventListener('error',event=>{
        const resource=event.target&&event.target!==target&&!event.error;
        let file=event.filename||'';if(resource)file=event.target.getAttribute?.('src')||event.target.getAttribute?.('href')||'';
        // URLs may carry account tokens. Keep just the path, with no query/hash.
        try{file=new URL(file,host.location?.href||'https://invalid.local/').pathname;}catch{file='';}
        report(event.error||{name:resource?'ResourceLoadError':'Error',message:event.message||(resource?'Resource failed to load':'Uncaught error')},
          {...context,operation:resource?'resource-load':'uncaught-error',file,line:event.lineno,column:event.colno});
      },true);
      target.addEventListener('unhandledrejection',event=>report(event.reason,{...context,operation:'unhandled-rejection'}));
    }
    return {build:BUILD,report,captureWorker,snapshotRequest,serializeError,install,
      list:()=>clean(records),exportJSON:()=>JSON.stringify({schemaVersion:1,build:BUILD,exportedAt:now(),records},null,2),
      clear(){records=[];persist();emit();},subscribe(fn){listeners.push(fn);return()=>{listeners=listeners.filter(f=>f!==fn);};}};
  }
  if(typeof module==='object'&&module.exports)module.exports={create,build:BUILD};
  else {root.STDiagnostics=create(root);if(root.document)root.STDiagnostics.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this);
