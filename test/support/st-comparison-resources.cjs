'use strict';
// Current, trusted component facts for pure ordering tests. These are not
// claimed gameplay histories or physically equivalent strategic continuations.
const R=require('../../st-rules'),C=require('../../st-obligation-context'),Provider=require('../../st-resource-provider'),M=require('../../st-obligation-resources');
let allowances;
function allowanceResource(status){
 if(!allowances){
  const position=R.createState({active:'Z',queue:[...'IJLOST'],streamCursor:1}),raw=C.exportState(C.start(position,{fresh:true}));
  raw.state.sl.foundationOpen=false;Object.assign(raw.state.account,{firstTsd:true,allocationVerified:true,opening:null});raw.state.account.profile.before=null;raw.state.account.profile.capEstablished=true;raw.state.account.z.remaining=1;
  const root=Provider.startRoute(Provider.prepare(position,{obligationContext:raw}));
  allowances={used:M.step(M.position(root),{witness:['L','L','L','HD']},root),available:M.step(M.position(root),{witness:['CW','R','R','R','R','HD']},root)};
 }
 return allowances[status]||{...allowances.used,extraZ:status};
}
module.exports={allowanceResource};
