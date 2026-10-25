'use strict';
// Evaluator wrapper only: the pure ledger and policy do not import this module.
const {isDeepStrictEqual}=require('node:util');
const E=require('./st-simulation.cjs'),L=require('./st-mino-ledger.cjs');
function resolve(input){
 const unknown=reason=>({schemaVersion:1,known:false,method:'unknown',reason,inputIdentityHash:L.identity(input)});
 if(input.schemaVersion!==1||!['empty','stable'].includes(input.scenario)||input.rng!==E.RNG_VERSION||!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>4294967295||!Number.isSafeInteger(input.locks)||input.locks<1||input.locks>2000)return unknown('Missing or unsupported generator contract');
 const generationLocks=(input.future?.length-14)/7;
 if(!Number.isSafeInteger(generationLocks)||generationLocks<1||generationLocks>2000)return unknown('Source length does not match a complete generated input');
 const generated=E.makeInput(input.scenario,input.seed,generationLocks,{withOrigins:true});
 if(!isDeepStrictEqual(generated.initial,input.initial)||!isDeepStrictEqual(generated.future,input.future)||generated.inputHash!==input.inputHash)return unknown('Regenerated initial state, full source or source hash differs');
 return{schemaVersion:1,known:true,method:'exact-generator-replay',inputIdentityHash:L.identity(input),generationLocks,evaluationCap:input.locks,...generated.pieceOrigins,note:'Bag indices are relative to this recorded input. Stable initial board and inventory remain unattributed; future bag boundaries are verified generator facts.'};
}
module.exports={resolve};
