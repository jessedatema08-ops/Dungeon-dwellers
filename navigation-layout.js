(()=>{
'use strict';
if(window.__DD_NAV_LAYOUT_V1)return;window.__DD_NAV_LAYOUT_V1=true;
const $=(s,r=document)=>r.querySelector(s);

const characterIcon='<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="7"/><path d="M11 41c1-11 6-17 13-17s12 6 13 17"/></svg>';
const npcIcon='<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="8"/><path d="M10 41c1-10 6-16 14-16s13 6 14 16M6 36c1-6 4-10 9-12m27 12c-1-6-4-10-9-12"/></svg>';

function apply(){
  // Put the player's character sheet on the persistent bottom navigation.
  const bottomNpc=$('.bottomNav [data-page="npc"]');
  if(bottomNpc&&!bottomNpc.dataset.ddSwapped){
    bottomNpc.dataset.page='character';
    bottomNpc.dataset.ddSwapped='1';
    bottomNpc.innerHTML=`${characterIcon}<span>Character</span>`;
    bottomNpc.setAttribute('aria-label','Character sheet');
  }

  // Put NPCs in the quick-action grid where Character used to be, directly beside Inventory.
  const quickCharacter=$('.quickGrid .quick[data-page="character"]');
  if(quickCharacter&&!quickCharacter.dataset.ddSwapped){
    quickCharacter.dataset.page='npc';
    quickCharacter.dataset.ddSwapped='1';
    quickCharacter.innerHTML=`${npcIcon}<span>NPCs</span>`;
    quickCharacter.setAttribute('aria-label','NPCs');
  }

  // Make the PDF behavior explicit: importing replaces the current character record.
  const pdfLabel=document.querySelector('label[for="characterPdf"]');
  if(pdfLabel)pdfLabel.textContent='Replace from PDF';
}

const observer=new MutationObserver(apply);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();observer.observe(document.body,{childList:true,subtree:true});});
else {apply();observer.observe(document.body,{childList:true,subtree:true});}
})();