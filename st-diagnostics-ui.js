/* Independent of the coach so failures during lab startup remain exportable. */
'use strict';
(() => {
  function init() {
    const diagnostics=globalThis.STDiagnostics,byId=id=>document.getElementById(id);
    const panel=byId('st-error-reports');
    if(!panel||!diagnostics)return;
    const json=byId('st-error-json'),status=byId('st-error-action-status');
    let actionVersion=0,lastCount=0;
    function render(){
      const reports=diagnostics.list(),latest=reports.at(-1);
      byId('st-error-count').textContent=`(${reports.length})`;
      byId('st-error-latest').textContent=latest?`Latest error: ${latest.error?.name||'Error'}: ${latest.error?.message||'See diagnostic JSON for details.'}`:'No errors recorded.';
      json.value=diagnostics.exportJSON();
      byId('st-error-clear').disabled=!reports.length;
      if(reports.length>lastCount)panel.open=true;
      lastCount=reports.length;
    }
    diagnostics.subscribe(render);render();
    byId('st-error-copy').addEventListener('click',async()=>{
      const version=++actionVersion,text=diagnostics.exportJSON();
      json.value=text;
      try{
        if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        if(version===actionVersion)status.textContent='Diagnostics copied. Review before sharing.';
      }catch{
        if(version!==actionVersion)return;
        status.textContent='Clipboard unavailable. Select the diagnostic JSON below and copy it manually.';
        panel.open=true;json.focus();json.select();
      }
    });
    byId('st-error-download').addEventListener('click',()=>{
      ++actionVersion;
      let url,link;
      try{
        const text=diagnostics.exportJSON();json.value=text;
        url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
        link=document.createElement('a');link.href=url;link.download='zztetris-diagnostics.json';link.hidden=true;
        document.body.append(link);link.click();
        status.textContent='Download requested. Reports stay local unless you share the file.';
      }catch{
        status.textContent='Download unavailable. Copy the diagnostic JSON below instead.';panel.open=true;
      }finally{
        link?.remove();if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    });
    byId('st-error-clear').addEventListener('click',()=>{
      ++actionVersion;diagnostics.clear();render();status.textContent='Local reports cleared.';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
