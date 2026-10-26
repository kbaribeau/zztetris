/* One production search allowance for browser, worker, simulations and timed
 * regression tests. Watchdogs and deliberately constrained probes are separate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STCoachConfig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
return Object.freeze({SEARCH_TIME_MS:1500});
});
