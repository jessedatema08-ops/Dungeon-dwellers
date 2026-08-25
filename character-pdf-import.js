(()=>{
'use strict';
if(window.__DD_CHARACTER_PDF_IMPORT)return;window.__DD_CHARACTER_PDF_IMPORT=true;
const $=(s,r=document)=>r.querySelector(s);
const DB=()=>window.DungeonDB;
function toast(text,type=''){const t=$('#toast');if(!t)return;t.textContent=text;t.className=`toast show ${type}`;clearTimeout(t._pdf);t._pdf=setTimeout(()=>t.className='toast',4200);}
async function extractPdf(file){
  if(!window.pdfjsLib)throw new Error('PDF reader did not load.');
  const data=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i),content=await page.getTextContent({includeMarkedContent:true});
    const rows=[];
    let lastY=null,line=[];
    for(const item of content.items){
      if(!item?.str)continue;
      const y=Math.round(item.transform?.[5]||0);
      if(lastY!==null&&Math.abs(y-lastY)>3){rows.push(line.join(' ').replace(/\s+/g,' ').trim());line=[];}
      line.push(item.str);lastY=y;
    }
    if(line.length)rows.push(line.join(' ').replace(/\s+/g,' ').trim());
    pages.push(rows.filter(Boolean).join('\n'));
  }
  return {text:pages.map((p,i)=>`--- PAGE ${i+1} ---\n${p}`).join('\n'),pageCount:pdf.numPages};
}
function normalizeProfile(p={}){
  p.identity=p.identity||{};p.abilities=p.abilities||{};p.defenses=p.defenses||{};p.equipment=p.equipment||{};p.spellcasting=p.spellcasting||{};
  for(const k of ['strength','dexterity','constitution','intelligence','wisdom','charisma']){
    const a=p.abilities[k]||{};const score=Number(a.score);if(Number.isFinite(score)){a.score=score;if(a.mod==null)a.mod=Math.floor((score-10)/2);}p.abilities[k]=a;
  }
  for(const k of ['weapons','armor','consumables','gear'])if(!Array.isArray(p.equipment[k]))p.equipment[k]=[];
  if(!Array.isArray(p.magicItems))p.magicItems=[];
  if(!Array.isArray(p.classFeatures))p.classFeatures=[];
  if(!Array.isArray(p.feats))p.feats=[];
  if(!Array.isArray(p.languages))p.languages=[];
  if(!Array.isArray(p.proficiencies))p.proficiencies=[];
  if(!p.identity.rulesEdition)p.identity.rulesEdition='D&D 5e 2024 revised';
  return p;
}
function previewImport(p,meta){
  const root=$('#modalRoot');if(!root)return;
  const id=p.identity||{},d=p.defenses||{},eq=p.equipment||{};
  const itemCount=['weapons','armor','consumables','gear'].reduce((n,k)=>n+(eq[k]?.length||0),0)+(p.magicItems?.length||0);
  const featureCount=(p.classFeatures?.length||0)+(p.feats?.length||0)+(p.speciesTraits?.length||0);
  root.classList.remove('hidden');
  root.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="eyebrow">Character PDF Import</div><h2>${escapeHtml(id.name||'Imported Character')}</h2><div class="modalBody"><p>The app extracted the entire PDF text, parsed the character sheet into structured game data, and will keep the full extracted source text attached to the character record for auditing.</p><div class="tagRow"><span class="tag">${escapeHtml(id.class||'Class ?')} ${escapeHtml(id.level?`· Level ${id.level}`:'')}</span><span class="tag">AC ${escapeHtml(d.armorClass??'—')}</span><span class="tag">HP ${escapeHtml(d.currentHp??d.maxHp??'—')} / ${escapeHtml(d.maxHp??'—')}</span><span class="tag">${itemCount} inventory entries</span><span class="tag">${featureCount} features/feats/traits</span><span class="tag">${meta.pageCount} PDF pages preserved</span></div><p class="statusLine">Import is intended to mirror the PDF exactly. You can still edit afterward if the source PDF itself is unusual or contains inaccessible image-only fields.</p></div><div class="buttonRow"><button id="pdfImportCancel" class="ghostBtn">Cancel</button><button id="pdfImportSave" class="goldBtn">Use This Character Sheet</button></div></div></div>`;
  $('#pdfImportCancel').onclick=()=>{root.classList.add('hidden');root.innerHTML='';};
  $('#pdfImportSave').onclick=async()=>{
    const btn=$('#pdfImportSave');btn.disabled=true;btn.textContent='Saving complete sheet...';
    try{
      const hp=Number(d.currentHp??d.maxHp??1)||1,maxHp=Number(d.maxHp??hp)||hp,ac=Number(d.armorClass??10)||10;
      const row=await DB().saveCharacter(localStorage.getItem('ddPreferredCampaign'),{name:id.name||'Adventurer',display_name:id.name||'Adventurer',source:'pdf',profile:p,hp,max_hp:maxHp,ac,import_meta:meta});
      root.classList.add('hidden');root.innerHTML='';toast(`Imported ${row.display_name||row.name} from PDF with full sheet data.`,'ok');setTimeout(()=>location.reload(),350);
    }catch(e){btn.disabled=false;btn.textContent='Use This Character Sheet';toast(e.message||String(e),'bad');}
  };
}
function escapeHtml(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
async function importFile(file){
  if(!file)return;
  const cid=localStorage.getItem('ddPreferredCampaign');if(!cid)throw new Error('Open a campaign first.');
  toast('Reading every available field from the character PDF...','warn');
  const extracted=await extractPdf(file);
  if(extracted.text.replace(/--- PAGE \d+ ---/g,'').trim().length<80)throw new Error('This PDF does not expose enough selectable text. Export a text-based character PDF rather than a scanned image.');
  const {data,error}=await DB().client.functions.invoke('character-import',{body:{campaignId:cid,fileName:file.name,pageCount:extracted.pageCount,rawText:extracted.text}});
  if(error)throw error;if(data?.ok===false)throw new Error(data.error||'Character import failed.');
  const profile=normalizeProfile(data.profile||{});
  const meta={source:'character-pdf',fileName:file.name,pageCount:extracted.pageCount,importedAt:new Date().toISOString(),rawText:extracted.text,parserVersion:'2-full-sheet',fieldCoverage:data.fieldCoverage||{},warnings:data.warnings||[]};
  profile.sourceDocument={fileName:file.name,pageCount:extracted.pageCount,rawText:extracted.text};
  previewImport(profile,meta);
}
document.addEventListener('change',e=>{
  const input=e.target?.closest?.('#characterPdf');if(!input)return;
  e.stopImmediatePropagation();
  const file=input.files?.[0];input.value='';
  importFile(file).catch(err=>toast(`PDF import failed: ${err.message||err}`,'bad'));
},true);
})();