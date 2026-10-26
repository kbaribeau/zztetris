'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),CLI=require('../scripts/simulate-st.cjs'),E=require('../scripts/lib/st-simulation.cjs');
test('simulation usage: opt-in boolean preserves production defaults and explicit configuration',()=>{
 assert.deepEqual(CLI.parse(['--usage-telemetry','--seeds','1']),{'usage-telemetry':true,seeds:'1'});
 assert.equal(CLI.configuration().usageTelemetry,undefined);assert.deepEqual(CLI.configuration(),E.CONFIG);
 const config=CLI.configuration(CLI.parse(['--usage-telemetry']));assert.equal(config.usageTelemetry,true);assert.equal(config.timeMs,1500);assert.equal(config.maxNodes,45000);assert.equal(E.CONFIG.usageTelemetry,undefined);
});
test('simulation usage: replay/compare cannot retroactively instrument recorded decisions',()=>{
 assert.throws(()=>CLI.main(['--replay','not-opened','--usage-telemetry']),/instruments new decisions/);
 assert.throws(()=>CLI.main(['--compare','not-opened-a','not-opened-b','--usage-telemetry']),/instruments new decisions/);
});
test('simulation usage: paired comparison refuses to mix instrumented and ordinary configurations',()=>{
 const episode={scenario:'empty',seed:1,inputHash:'same',locks:1,stop:'lock-cap',censored:true,profile:[{lines:0,height:1}]},base={schemaVersion:1,complete:true,config:CLI.configuration(),locks:1,rng:E.RNG_VERSION,lane:'production-wall-clock',execution:'rapid-uninterrupted-actual-witness-v1',episodes:[episode]};
 assert.throws(()=>CLI.compare(base,{...base,config:CLI.configuration({'usage-telemetry':true})}),/Incompatible budgets/);
 // Deliberately different historical budget: this comparison must reject it.
 assert.throws(()=>CLI.compare(base,{...base,config:{...base.config,timeMs:750}}),/Incompatible budgets/);
});
