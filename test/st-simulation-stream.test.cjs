'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const CLI=require('../scripts/simulate-st.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-stream-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'trace.jsonl');}
test('simulation stream preserves UTF-8 across chunks and final unterminated line',t=>{
 const file=fixture(t),a={padding:'a'.repeat(65520),text:'résumé 🟦'},b={kind:'lock',lock:2};
 fs.writeFileSync(file,JSON.stringify(a)+'\r\n\n'+JSON.stringify(b));assert.deepEqual([...CLI.streamTrace(file)],[a,b]);
});
test('simulation stream retains malformed input and releases the descriptor',t=>{
 const file=fixture(t),bytes='{"kind":"lock"}\nmalformed\n';fs.writeFileSync(file,bytes);
 assert.throws(()=>[...CLI.streamTrace(file)],SyntaxError);assert.equal(fs.readFileSync(file,'utf8'),bytes);
 assert.deepEqual([...CLI.streamTrace((fs.writeFileSync(file,''),file))],[]);
});
test('simulation stream permits bounded large traces but eager reader remains protected',t=>{
 const file=fixture(t);fs.writeFileSync(file,'');fs.truncateSync(file,512*1024*1024+1);
 assert.throws(()=>[...CLI.streamTrace(file)],/512 MiB/);assert.throws(()=>CLI.readTrace(file),/64 MiB/);
});
