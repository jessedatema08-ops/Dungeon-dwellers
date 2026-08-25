(()=>{
'use strict';
if(window.__DD_NAV_LAYOUT_V4)return;window.__DD_NAV_LAYOUT_V4=true;
const $=(s,r=document)=>r.querySelector(s);

const characterIcon='<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="7"/><path d="M11 41c1-11 6-17 13-17s12 6 13 17"/></svg>';
const npcIcon='<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="8"/><path d="M10 41c1-10 6-16 14-16s13 6 14 16M6 36c1-6 4-10 9-12m27 12c-1-6-4-10-9-12"/></svg>';

function patchPdfLib(lib){
  if(!lib||lib.__ddFormFieldExtraction)return;
  const original=lib.getDocument?.bind(lib);
  if(!original)return;
  lib.__ddFormFieldExtraction=true;
  lib.getDocument=(...args)=>{
    const task=original(...args);
    task?.promise?.then(pdf=>{
      if(!pdf||pdf.__ddFormFieldExtraction)return;
      pdf.__ddFormFieldExtraction=true;
      const getPage=pdf.getPage.bind(pdf);
      pdf.getPage=async pageNumber=>{
        const page=await getPage(pageNumber);
        if(!page||page.__ddFormFieldExtraction)return page;
        page.__ddFormFieldExtraction=true;
        const getTextContent=page.getTextContent.bind(page);
        page.getTextContent=async options=>{
          const content=await getTextContent(options);
          let annotations=[];
          try{annotations=await page.getAnnotations({intent:'display'});}catch{}
          const fields=[];
          for(const a of annotations||[]){
            if(a?.subtype!=='Widget'||!a?.fieldName)continue;
            let value=a.fieldValue;
            if(Array.isArray(value))value=value.join(', ');
            if(value===undefined||value===null||value==='')continue;
            fields.push(`[FORM FIELD] ${String(a.fieldName).trim()}: ${String(value).trim()}`);
          }
          if(!fields.length)return content;
          const extras=fields.map((str,i)=>({str,dir:'ltr',width:0,height:0,transform:[1,0,0,1,0,-10000-i],fontName:''}));
          return {...content,items:[...(content.items||[]),...extras]};
        };
        return page;
      };
    }).catch(()=>{});
    return task;
  };
}

function installPdfPatch(){
  if(window.pdfjsLib){patchPdfLib(window.pdfjsLib);return;}
  let pending;
  try{
    Object.defineProperty(window,'pdfjsLib',{configurable:true,get(){return pending},set(v){pending=v;patchPdfLib(v)}});
  }catch{}
}

function apply(){
  const bottomNpc=$('.bottomNav [data-page="npc"]');
  if(bottomNpc&&!bottomNpc.dataset.ddSwapped){
    bottomNpc.dataset.page='character';
    bottomNpc.dataset.ddSwapped='1';
    bottomNpc.innerHTML=`${characterIcon}<span>Character</span>`;
    bottomNpc.setAttribute('aria-label','Character sheet');
  }

  const quickCharacter=$('.quickGrid .quick[data-page="character"]');
  if(quickCharacter&&!quickCharacter.dataset.ddSwapped){
    quickCharacter.dataset.page='npc';
    quickCharacter.dataset.ddSwapped='1';
    quickCharacter.innerHTML=`${npcIcon}<span>NPCs</span>`;
    quickCharacter.setAttribute('aria-label','NPCs');
  }

  const pdfLabel=document.querySelector('label[for="characterPdf"]');
  if(pdfLabel&&pdfLabel.textContent!=='Import PDF')pdfLabel.textContent='Import PDF';
}

installPdfPatch();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();
})();