'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');

const MAX_PARALLEL=32,MAX_OUTPUT=1024*1024;
function concurrency(value=1){
  const count=Number(value);
  if(!Number.isSafeInteger(count)||count<1||count>MAX_PARALLEL)throw Error(`parallel must be an integer 1..${MAX_PARALLEL}`);
  return count;
}
function createRunDirectory(parent){
  fs.mkdirSync(parent,{recursive:true});
  return fs.mkdtempSync(path.join(parent,new Date().toISOString().replaceAll(':','-')+'-'+process.pid+'-'));
}
// Queue order is fixed, completion order is not. Wait for every started task,
// even after one fails, so callers can safely finish artifacts and clean up.
async function runPool(items,parallel,task,{signal,onError=()=>{}}={}){
  parallel=concurrency(parallel);
  const results=new Array(items.length);let next=0,error;
  const worker=async()=>{
    while(!error&&!signal?.aborted){
      const index=next++;if(index>=items.length)return;
      try{results[index]=await task(items[index],index);}
      catch(caught){if(!error){error=caught;onError(caught);}}
    }
  };
  await Promise.all(Array.from({length:Math.min(parallel,items.length)},worker));
  if(error)throw error;
  return results;
}
// A separate timer belongs to each child, beginning only when it is spawned.
// SIGKILL remains effective when synchronous JavaScript cannot cooperate.
function runChild(command,args,{cwd,timeoutMs,signal,maxOutput=MAX_OUTPUT}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1)throw Error('Child timeout must be a positive integer');
  if(signal?.aborted)return Promise.resolve({status:null,signal:null,error:Object.assign(Error('Run interrupted before spawn'),{code:'ABORT_ERR'}),stdout:'',stderr:''});
  return new Promise(resolve=>{
    let child,timer,error,bytes=0,stdout='',stderr='';
    const stop=reason=>{error??=reason;child?.kill('SIGKILL');};
    const abort=()=>stop(Object.assign(Error('Run interrupted'),{code:'ABORT_ERR'}));
    const finish=(status,exitSignal)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve({status,signal:exitSignal,error,stdout,stderr});};
    try{child=spawn(command,args,{cwd,stdio:['ignore','pipe','pipe']});}
    catch(caught){error=caught;finish(null,null);return;}
    child.on('error',caught=>{error??=caught;});
    for(const [name,stream]of [['stdout',child.stdout],['stderr',child.stderr]])stream.on('data',chunk=>{
      const available=Math.max(0,maxOutput-bytes);bytes+=chunk.length;
      const text=chunk.subarray(0,available).toString();if(name==='stdout')stdout+=text;else stderr+=text;
      if(bytes>maxOutput)stop(Object.assign(Error('Child output exceeded 1 MiB'),{code:'ENOBUFS'}));
    });
    child.once('close',finish);
    timer=setTimeout(()=>stop(Object.assign(Error('Episode exceeded wall watchdog'),{code:'ETIMEDOUT'})),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
  });
}
module.exports={MAX_PARALLEL,concurrency,createRunDirectory,runPool,runChild};
