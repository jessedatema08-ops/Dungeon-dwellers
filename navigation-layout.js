(()=>{
'use strict';
if(window.__DD_NAV_LAYOUT_V2)return;window.__DD_NAV_LAYOUT_V2=true;
const $=(s,r=document)=>r.querySelector(s);

const characterIcon='<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="7"/><path d="M11 41c1-11 6-17 13-17s12 6 13 17"/></svg>';
const npcIcon='<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="8"/><path d="M10 41c1-10 6-16 14-16s13 6 14 16M6 36c1-6 4-10 9-12m27 12c-1-6-4-10-9-12"/></svg>';

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
  if(pdfLabel&&pdfLabel.textContent!=='Replace from PDF')pdfLabel.textContent='Replace from PDF';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();
})();