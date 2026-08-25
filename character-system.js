(()=>{
'use strict';
if(window.__DD_CHARACTER_SYSTEM_V4)return;window.__DD_CHARACTER_SYSTEM_V4=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const DB=()=>window.DungeonDB;
const campaignId=()=>localStorage.getItem('ddPreferredCampaign');
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
let importing=false;

function toast(text,type=''){const t=$('#toast');if(!t)return;t.textContent=text;t.className=`toast show ${type}`;clearTimeout(t._character);t._character=setTimeout(()=>t.className='toast',4500);}
function progress(text){let root=$('#characterImportProgress');if(!root){root=document.createElement('div');root.id='characterImportProgress';root.innerHTML='<div class="characterImportBox"><div class="eyebrow">D&D Beyond PDF</div><h2>Creating character</h2><div id="characterImportStatus" class="statusLine"></div><div class="characterImportBar"><i></i></div></div>';document.body.appendChild(root);}$('#characterImportStatus').textContent=text;}
function endProgress(){$('#characterImportProgress')?.remove();}
function installStyles(){if($('#characterSystemStyles'))return;const s=document.createElement('style');s.id='characterSystemStyles';s.textContent=`#characterImportProgress{position:fixed;inset:0;z-index:1600;background:rgba(3,5,8,.9);display:grid;place-items:center;padding:20px}.characterImportBox{width:min(92vw,460px);border:1px solid #a67d39;border-radius:18px;background:#08090b;padding:20px;box-shadow:0 30px 90px #000}.characterImportBox h2{font-family:Georgia,serif;color:#efd08a;margin:6px 0 10px}.characterImportBar{height:8px;border-radius:999px;background:#191e24;overflow:hidden;margin-top:15px}.characterImportBar i{display:block;height:100%;width:24%;background:linear-gradient(90deg,#8d6a30,#e6c06e);animation:ddImport 1.15s ease-in-out infinite alternate}@keyframes ddImport{to{transform:translateX(315%)}}.completeSheet{margin-top:14px}.sheetSection{border-top:1px solid #3f321c;padding-top:15px;margin-top:15px}.sheetSection:first-child{border-top:0;margin-top:0}.sheetSection h3{font:500 18px Georgia,serif;color:#dfc17d;margin:0 0 10px}.sheetGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sheetField,.sheetEntry{border:1px solid #6f5428;border-radius:12px;background:#090b0e;padding:10px}.sheetField b{display:block;color:#9b8d70;text-transform:uppercase;letter-spacing:.08em;font-size:9px}.sheetField span{display:block;color:#e0e3e7;font-size:12px;line-height:1.45;margin-top:4px;white-space:pre-wrap;word-break:break-word}.sheetList{display:grid;gap:8px}.sheetEntry strong{display:block;color:#ead29b;font-size:12px}.sheetEntry pre,.sheetJson{margin:6px 0 0;color:#cbd0d6;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}.sheetRaw{max-height:340px;overflow:auto;border:1px solid #5b4524;border-radius:12px;background:#050608;padding:10px;color:#aab0b8;font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}.sheetSource{font-size:10px;color:#818892;margin-top:5px}.sheetNotice{border:1px solid #7b5c2b;background:#151006;border-radius:12px;padding:10px;color:#d7be83;font-size:11px;margin-top:10px}@media(max-width:560px){.sheetGrid{grid-template-columns:1fr}}`;document.head.appendChild(s);}

async function extractPdf(file){
  if(!window.pdfjsLib)throw new Error('PDF reader did not load. Reload the app and try again.');
  const data=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument({data}).promise,pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    progress(`Reading page ${i} of ${pdf.numPages}...`);
    const page=await pdf.getPage(i),content=await page.getTextContent({includeMarkedContent:true});
    const items=content.items.filter(x=>x?.str);let rows=[],line=[],lastY=null;
    for(const item of items){const y=Math.round(item.transform?.[5]||0);if(lastY!==null&&Math.abs(y-lastY)>3){if(line.length)rows.push(line.join(' ').replace(/\s+/g,' ').trim());line=[];}line.push(item.str);lastY=y;}
    if(line.length)rows.push(line.join(' ').replace(/\s+/g,' ').trim());
    pages.push(`--- PAGE ${i} ---\n${rows.filter(Boolean).join('\n')}`);
  }
  return {text:pages.join('\n\n'),pageCount:pdf.numPages};
}

function openCharacterPage(){
  const btn=$('.bottomNav [data-page="character"]')||$('.quickGrid [data-page="character"]');
  if(btn){btn.click();return;}
  const page=$('#characterPage');if(!page)return;
  $$('.page').forEach(p=>p.classList.toggle('active',p===page));window.scrollTo({top:0,behavior:'auto'});
}
function display(v){if(v==null||v===''||(Array.isArray(v)&&!v.length))return '—';if(typeof v==='boolean')return v?'Yes':'No';if(typeof v==='object')return JSON.stringify(v,null,2);return String(v);}
function label(k){return String(k).replace(/[_-]/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,c=>c.toUpperCase());}
function field(k,v){return `<div class="sheetField"><b>${esc(label(k))}</b><span>${esc(display(v))}</span></div>`;}
function objectGrid(obj={}){const rows=Object.entries(obj||{});return rows.length?`<div class="sheetGrid">${rows.map(([k,v])=>field(k,v)).join('')}</div>`:'<div class="sheetEmpty">No data printed in this section.</div>';}
function listSection(items=[]){if(!Array.isArray(items)||!items.length)return '<div class="sheetEmpty">No entries printed in this section.</div>';return `<div class="sheetList">${items.map((x,i)=>x&&typeof x==='object'?`<div class="sheetEntry"><strong>${esc(x.name||x.title||x.label||`Entry ${i+1}`)}</strong><pre>${esc(JSON.stringify(x,null,2))}</pre></div>`:`<div class="sheetEntry"><strong>${esc(String(x))}</strong></div>`).join('')}</div>`;}
function section(title,html){return `<section class="sheetSection"><h3>${esc(title)}</h3>${html}</section>`;}
function inventory(p){const e=p.equipment||{},groups=['weapons','armor','gear','consumables','magicItems'];return groups.map(k=>`<div style="margin-top:10px"><div class="eyebrow">${esc(label(k))}</div>${listSection(e[k]||[])}</div>`).join('')+`<div style="margin-top:12px">${objectGrid({currency:e.currency,carriedWeight:e.carriedWeight,carryingCapacity:e.carryingCapacity})}</div>`;}
function features(p){return listSection([...(p.features||[]),...(p.classFeatures||[]),...(p.speciesFeatures||[]),...(p.backgroundFeatures||[]),...(p.feats||[])]);}
function spellcasting(sp={}){const {spells=[], ...meta}=sp||{};return `${objectGrid(meta)}<div style="margin-top:12px"><div class="eyebrow">Spells</div>${listSection(spells)}</div>`;}

function renderImportedCharacter(ch){
  const root=$('#characterContent'),p=ch?.profile;if(!root||!p?.importedPdf)return;
  $('#completeImportedSheet')?.remove();
  const covered=new Set(['identity','appearance','biography','abilities','savingThrows','skills','passiveScores','defenses','proficiencyBonus','inspiration','proficiencies','attacks','equipment','features','classFeatures','speciesFeatures','backgroundFeatures','feats','resources','spellcasting','companions','importedSections','unclassified','importedPdf']);
  const extra=Object.fromEntries(Object.entries(p).filter(([k])=>!covered.has(k))),imp=p.importedPdf||{};
  const el=document.createElement('div');el.id='completeImportedSheet';el.className='completeSheet';
  el.innerHTML=`<section class="sheetSection"><div class="eyebrow">Imported Character Sheet</div><h2>${esc(p.identity?.name||ch.display_name||ch.name||'Character')}</h2><div class="sheetSource">${esc(imp.filename||'Character PDF')} · ${imp.importedAt?esc(new Date(imp.importedAt).toLocaleString()):'imported'}</div><div class="sheetNotice">The PDF created this character automatically. Every parsed field is shown below; unclassified data and the extracted source text are preserved.</div></section>${section('Identity',objectGrid(p.identity||{}))}${section('Appearance',objectGrid(p.appearance||{}))}${section('Defenses, HP & Movement',objectGrid(p.defenses||{}))}${section('Ability Scores',objectGrid(p.abilities||{}))}${section('Saving Throws',objectGrid(p.savingThrows||{}))}${section('Skills',objectGrid(p.skills||{}))}${section('Passive Scores',objectGrid(p.passiveScores||{}))}${section('Proficiency & Inspiration',objectGrid({proficiencyBonus:p.proficiencyBonus,inspiration:p.inspiration}))}${section('Proficiencies & Languages',objectGrid(p.proficiencies||{}))}${section('Attacks',listSection(p.attacks||[]))}${section('Equipment, Inventory & Currency',inventory(p))}${section('Features, Traits & Feats',features(p))}${section('Resources',listSection(p.resources||[]))}${section('Spellcasting',spellcasting(p.spellcasting||{}))}${section('Biography, Personality & Notes',objectGrid(p.biography||{}))}${section('Companions',listSection(p.companions||[]))}${section('Imported / Unclassified Data',`${listSection(p.importedSections||[])}<div style="margin-top:12px">${listSection(p.unclassified||[])}</div>`)}${Object.keys(extra).length?section('Additional Parsed PDF Data',`<pre class="sheetJson">${esc(JSON.stringify(extra,null,2))}</pre>`):''}${section('Import Record',objectGrid({source:imp.source,filename:imp.filename,importedAt:imp.importedAt,pageCount:imp.pageCount}))}${section('Complete Extracted PDF Text',`<div class="sheetRaw">${esc(imp.rawText||'No raw text was retained.')}</div>`)}`;
  root.appendChild(el);
}
async function renderCurrentImported(){const cid=campaignId(),db=DB();if(!cid||!db)return;try{renderImportedCharacter(await db.character(cid));}catch(e){console.warn('Imported character render failed',e);}}

async function importPdf(file){
  if(importing)return;const cid=campaignId();if(!cid)throw new Error('Open a campaign before importing a character.');
  importing=true;
  try{
    progress('Opening your character PDF...');
    const extracted=await extractPdf(file);
    if(extracted.text.replace(/--- PAGE \d+ ---/g,'').trim().length<40)throw new Error('The PDF did not expose readable character-sheet text. Export a text-based character PDF and try again.');
    progress('Creating and filling the character from the PDF...');
    const {data,error}=await DB().client.functions.invoke('character-import',{body:{campaignId:cid,filename:file.name,fileName:file.name,pdfText:extracted.text,rawText:extracted.text,pageCount:extracted.pageCount,createFresh:true}});
    if(error)throw error;if(data?.ok===false)throw new Error(data.error||'Character import failed.');
    progress('Character created. Opening the completed sheet...');
    openCharacterPage();
    renderImportedCharacter(data.character||{profile:data.profile});
    setTimeout(()=>renderCurrentImported(),350);
    toast(`${data.character?.name||'Character'} imported and created.`, 'ok');
  }finally{importing=false;endProgress();}
}

// Import work begins only when the user selects a PDF. No polling or DOM observers.
document.addEventListener('change',async e=>{
  const input=e.target;if(!(input instanceof HTMLInputElement)||input.id!=='characterPdf')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  const file=input.files?.[0];input.value='';if(!file)return;
  if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name)){toast('Choose a PDF character sheet.','bad');return;}
  try{await importPdf(file);}catch(err){toast(`Character import failed: ${err.message||err}`,'bad');}
},true);

// A deliberate Character-page navigation performs one read so imported details are visible.
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="character"]'))setTimeout(renderCurrentImported,0);},true);
installStyles();
})();