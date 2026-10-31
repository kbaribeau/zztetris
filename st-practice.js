/* Player-only finite draw tape around the visible-only coaching-session format.
 * Never import this module in the coach/worker or pass its envelope to planning. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./st-session'),require('./st-bag')):factory(root.STSession,root.STBag);if(typeof module==='object'&&module.exports)module.exports=api;else root.STPractice=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Session,B){
'use strict';
const FORMAT='zztetris-st-practice',VERSION=1;
const LIMITS=Object.freeze({bytes:Session.LIMITS.bytes,pieces:4096});
function keys(value,expected){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===expected.slice().sort().join();}
function prepare(input){
 if(!keys(input,['format','schemaVersion','session','privatePractice'])||input.format!==FORMAT||input.schemaVersion!==VERSION)throw Error('Unsupported private practice format version or properties.');
 if(!keys(input.privatePractice,['tail']))throw Error('Invalid private practice supply.');
 const tail=input.privatePractice.tail;
 if(!Array.isArray(tail)||tail.length>LIMITS.pieces||Array.from(tail).some(t=>typeof t!=='string'||!/^[IJLOSTZ]$/.test(t)))throw Error('Private practice tail must contain at most 4096 piece letters.');
 const session=Session.prepare(input.session);
 if(JSON.stringify(input).length>LIMITS.bytes)throw Error('Private practice exceeds size limit.');
 if(tail.length&&session.state.queue.length!==6)throw Error('Private practice tail must begin after six visible preview pieces.');
 // The public bag is already at the END of preview. Never consume the preview
 // twice. With no bag evidence, check all phases consistent with the preview;
 // active/held pieces can be old and are not a contiguous draw-history claim.
 let frontier=session.state.bag||B.fromObserved({observed:session.state.queue});
 if(B.validate(frontier).length)throw Error('Private practice contradicts the visible seven-bag stream.');
 for(const type of tail){frontier=B.consume(frontier,type);if(B.validate(frontier).length)throw Error('Private practice tail contradicts the public bag frontier.');}
 // Validation must not narrow public knowledge using this private future.
 return{session,tail:tail.slice()};
}
function create(session,tail){const envelope={format:FORMAT,schemaVersion:VERSION,session,privatePractice:{tail}};prepare(envelope);return JSON.parse(JSON.stringify(envelope));}
function parse(text){if(typeof text!=='string'||text.length>LIMITS.bytes)throw Error('Private practice exceeds size limit.');return prepare(JSON.parse(text));}
return Object.freeze({FORMAT,VERSION,LIMITS,create,prepare,parse});
});
