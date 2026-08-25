(()=>{
'use strict';
if(window.__DD_CHARACTER_IMPORT_V2)return;window.__DD_CHARACTER_IMPORT_V2=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const DB=()=>window.DungeonDB;
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const cid=()=>localStorage.getItem('ddPreferredCampaign');
let rendering=false;

function toast(msg,type=''){const t=$('#toast');if(!t)return;t.textContent=msg;t.className=`toast show ${type}`;clearTimeout(t._ci);t._ci=setTimeout(()=>t.className='toast',5000);}
function installStyles(){if($('#characterImportStyles'))return;const s=document.createElement('style');s.id='characterImportStyles';s.textContent=`
.importProgress{position:fixed;inset:0;z-index:1200;background:rgba(3,5,8,.86);display:grid;place-items:center;padding:20px}.importProgressBox{width:min(92vw,440px);border:1px solid #6b5735;border-radius:20px;background:#0b0f13;padding:20px;box-shadow:0 30px 90px #000}.importProgressBox h2{margin:5px 0 8px;font-family:Georgia,serif}.importBar{height:8px;border-radius:999px;background:#191e24;overflow:hidden;margin-top:14px}.importBar i{display:block;height:100%;width:18%;background:linear-gradient(90deg,#8d6a30,#e6c06e);animation:ciBar 1.2s ease-in-out infinite alternate}@keyframes ciBar{to{transform:translateX(430%)}}
.richSheet{margin-top:16px}.richSection{border-top:1px solid #282e35;padding-top:14px;margin-top:14px}.richSection h3{font:500 18px Georgia,serif;color:#dfc17d;margin:0 0 9px}.richGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.richStat,.richOpen{border:1px solid #2c3239;border-radius:12px;background:#0c1014;padding:9px 10px}.richStat strong,.richStat span{display:block}.richStat strong{font-size:10px;color:#8f969f;text-transform:uppercase;letter-spacing:.08em}.richStat span{margin-top:3px;font-size:13px}.richList{display:grid;gap:7px}.richOpen{width:100%;text-align:left;color:#dfe2e6}.richOpen strong{display:block;color:#ead29b;font-size:12px}.richOpen span{display:block;color:#8f969f;font-size:10px;margin-top:3px;white-space:normal}.detailTable{display:grid;gap:7px}.detailRow{border-bottom:1px solid #242a31;padding-bottom:7px}.detailRow b{display:block;color:#d8b86f;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.detailRow span,.detailRow pre{display:block;margin:3px 0 0;color:#dde0e4;font:12px/1.45 Inter,system-ui,sans-serif;white-space:pre-wrap;word-break:break-word}.pdfRaw{max-height:300px;overflow:auto;border:1px solid #282e35;border-radius:12px;background:#090c10;padding:10px;white-space:pre-wrap;font-size:10px;color:#a7adb5}.importSource{font-size:10px;color:#7f8790;margin-top:8px}.spellMeta{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.spellMeta em{font-style:normal;border:1px solid #343b44;border-radius:999px;padding:2px 6px;font-size:9px;color:#b8bec6}@media(max-width:560px){.richGrid{grid-template-columns:1fr}}
`;document.head.appendChild(s);}

function progress(text){let root=$('#characterImportProgress');if(!root){root=document.createElement('div');root.id='characterImportProgress';root.className='importProgress';root.innerHTML='<div class="importProgressBox"><div class="eyebrow">D&D Beyond Import</div><h2>Importing character</h2><div id="ciStatus" class="statusLine"></div><div class="importBar"><i></i></div></div>';document.body.appendChild(root);}$('#ciStatus').textContent=text;}
function endProgress(){ $('#characterImportProgress')?.remove(); }

async function extractPdf(file){
  if(!window.pdfjsLib)throw new Error('PDF reader did not load. Reload the app and try again.');
  const data=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument({data}).promise;let pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    progress(`Reading page ${i} of ${pdf.numPages}...`);
    const page=await pdf.getPage(i),content=await page.getTextContent();
    const text=content.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();
    pages.push(`--- PAGE ${i} ---\n${text}`);
  }
  return pages.join('\n\n');
}

async function importPdf(file){
  const campaignId=cid();if(!campaignId)throw new Error('Open a campaign before importing a character.');
  progress('Opening your D&D Beyond PDF...');
  const pdfText=await extractPdf(file);if(pdfText.length<40)throw new Error('The PDF did not contain readable character-sheet text. Export a normal D&D Beyond character PDF and try again.');
  progress('Reading every stat, item, feature, proficiency, and spell...');
  const {data,error}=await DB().client.functions.invoke('character-import',{body:{campaignId,filename:file.name,pdfText}});
  if(error)throw error;if(data?.ok===false)throw new Error(data.error||'Character import failed.');
  progress('Character imported. Loading the complete sheet...');
  await new Promise(r=>setTimeout(r,400));
  location.reload();
}

// Capture before the old lightweight PDF importer can run.
document.addEventListener('change',async e=>{
  const input=e.target;if(!(input instanceof HTMLInputElement)||input.id!=='characterPdf')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  const file=input.files?.[0];input.value='';if(!file)return;
  if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name)){toast('Choose a D&D Beyond PDF.','bad');return;}
  try{await importPdf(file);}catch(err){endProgress();toast(`Character import failed: ${err.message||err}`,'bad');}
},true);

function value(v){if(v==null||v===''||(Array.isArray(v)&&!v.length))return '—';if(Array.isArray(v))return v.map(x=>typeof x==='object'?(x.name||JSON.stringify(x)):x).join(', ');if(typeof v==='object')return Object.entries(v).map(([k,x])=>`${k}: ${typeof x==='object'?JSON.stringify(x):x}`).join(' · ');return String(v);}
function stat(label,v){return `<div class="richStat"><strong>${esc(label)}</strong><span>${esc(value(v))}</span></div>`;}
function summary(o){if(!o||typeof o!=='object')return value(o);return [o.type,o.level!=null?`Level ${o.level}`:null,o.damage,o.damageType,o.attackBonus!=null?`Attack ${Number(o.attackBonus)>=0?'+':''}${o.attackBonus}`:null,o.range,o.school,o.quantity!=null?`Qty ${o.quantity}`:null,o.source,o.actionType].filter(Boolean).join(' · ')||'View details';}
function openDetail(title,obj){
  const root=$('#modalRoot');if(!root)return;const rows=Object.entries(obj||{}).filter(([,v])=>v!=null&&v!==''&&!(Array.isArray(v)&&!v.length)&&!(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length));
  root.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="eyebrow">Character Sheet</div><h2>${esc(title)}</h2><div class="modalBody detailTable">${rows.map(([k,v])=>`<div class="detailRow"><b>${esc(k.replace(/([A-Z])/g,' $1'))}</b>${typeof v==='object'?`<pre>${esc(JSON.stringify(v,null,2))}</pre>`:`<span>${esc(v)}</span>`}</div>`).join('')||'<div class="statusLine">No additional printed details.</div>'}</div><div class="buttonRow"><button id="detailClose" class="goldBtn">Close</button></div></div></div>`;root.classList.remove('hidden');$('#detailClose').onclick=()=>{root.classList.add('hidden');root.innerHTML='';};
}
function listButtons(items,kind){return `<div class="richList">${(items||[]).map((x,i)=>{const o=typeof x==='object'?x:{name:String(x)};return `<button class="richOpen" data-rich-kind="${kind}" data-rich-i="${i}"><strong>${esc(o.name||o.title||`${kind} ${i+1}`)}</strong><span>${esc(summary(o))}</span></button>`;}).join('')||'<div class="statusLine">None printed on the imported sheet.</div>'}</div>`;}
function allFeatures(p){return [...(p.features||[]),...(p.classFeatures||[]),...(p.speciesFeatures||[]),...(p.backgroundFeatures||[]),...(p.feats||[])];}
function allInventory(p){const e=p.equipment||{};return [...(e.weapons||[]),...(e.armor||[]),...(e.gear||[]),...(e.consumables||[]),...(e.magicItems||[])];}

async function renderRich(){
  if(rendering)return;const root=$('#characterContent'),campaignId=cid();if(!root||!campaignId)return;rendering=true;
  try{
    const ch=await DB().character(campaignId);const p=ch?.profile;if(!p||!p.importedPdf)return;
    $('#enhancedImportedSheet')?.remove();
    const d=p.defenses||{},id=p.identity||{},ap=p.appearance||{},pro=p.proficiencies||{},sp=p.spellcasting||{};
    const abilities=p.abilities||{},saves=p.savingThrows||{},skills=p.skills||{};
    const el=document.createElement('div');el.id='enhancedImportedSheet';el.className='richSheet';
    el.innerHTML=`
      <div class="richSection"><div class="eyebrow">Imported D&D Beyond Sheet</div><h2>${esc(id.name||ch.display_name||'Character')}</h2><div class="importSource">${esc(p.importedPdf.filename||'D&D Beyond PDF')} · imported ${new Date(p.importedPdf.importedAt).toLocaleString()}</div></div>
      <div class="richSection"><h3>Identity & Appearance</h3><div class="richGrid">${stat('Class / Level',[id.class,id.subclass,id.level&&`Level ${id.level}`].filter(Boolean).join(' · '))}${stat('Species / Race',id.species||id.race||id.lineage)}${stat('Background',id.background)}${stat('Alignment',id.alignment)}${stat('Player',id.playerName)}${stat('Age',ap.age)}${stat('Height',ap.height)}${stat('Weight',ap.weight)}${stat('Eyes',ap.eyes)}${stat('Skin',ap.skin)}${stat('Hair',ap.hair)}${stat('Size',ap.size)}${stat('Appearance',ap.description)}</div></div>
      <div class="richSection"><h3>Core Stats</h3><div class="richGrid">${stat('Armor Class',d.armorClass)}${stat('Hit Points',`${d.currentHp??'—'} / ${d.maxHp??'—'}`)}${stat('Temp HP',d.tempHp)}${stat('Initiative',d.initiativeBonus)}${stat('Speed',d.speed)}${stat('Movement',d.movement)}${stat('Proficiency Bonus',p.proficiencyBonus)}${stat('Inspiration',p.inspiration)}${stat('Hit Dice',d.hitDice)}${stat('Senses',d.senses)}</div></div>
      <div class="richSection"><h3>Abilities</h3><div class="richGrid">${Object.entries(abilities).map(([k,v])=>stat(k,v)).join('')}</div></div>
      <div class="richSection"><h3>Saving Throws</h3><div class="richGrid">${Object.entries(saves).map(([k,v])=>stat(k,v)).join('')||stat('Saving Throws','None parsed')}</div></div>
      <div class="richSection"><h3>Skills & Passive Scores</h3><div class="richGrid">${Object.entries(skills).map(([k,v])=>stat(k,v)).join('')}${Object.entries(p.passiveScores||{}).map(([k,v])=>stat(`Passive ${k}`,v)).join('')}</div></div>
      <div class="richSection"><h3>Proficiencies & Languages</h3><div class="richGrid">${stat('Armor',pro.armor)}${stat('Weapons',pro.weapons)}${stat('Tools',pro.tools)}${stat('Skills',pro.skills)}${stat('Saving Throws',pro.savingThrows)}${stat('Languages',pro.languages)}${stat('Other',pro.other)}</div></div>
      <div class="richSection"><h3>Weapons & Attacks</h3>${listButtons([...(p.attacks||[]),...((p.equipment||{}).weapons||[])],'weapon')}</div>
      <div class="richSection"><h3>Features, Traits & Feats</h3>${listButtons(allFeatures(p),'feature')}</div>
      <div class="richSection"><h3>Spellcasting</h3><div class="richGrid">${stat('Spellcasting Ability',sp.ability)}${stat('Spell Save DC',sp.spellSaveDC)}${stat('Spell Attack Bonus',sp.spellAttackBonus)}${stat('Spell Slots',sp.slots)}${stat('Spellcasting Classes',sp.classes)}</div><div style="margin-top:10px">${listButtons(sp.spells||[],'spell')}</div></div>
      <div class="richSection"><h3>Biography & Notes</h3><div class="richGrid">${Object.entries(p.biography||{}).map(([k,v])=>stat(k,v)).join('')||stat('Notes','None printed')}</div></div>
      <div class="richSection"><h3>Resources & Companions</h3>${listButtons([...(p.resources||[]),...(p.companions||[])],'resource')}</div>
      <div class="richSection"><details><summary>Complete imported PDF text</summary><p class="statusLine">This preserves the readable text from the PDF so details that do not fit a standard character field are still visible.</p><div class="pdfRaw">${esc(p.importedPdf.rawText||'')}</div></details></div>`;
    root.appendChild(el);
    const map={weapon:[...(p.attacks||[]),...((p.equipment||{}).weapons||[])],feature:allFeatures(p),spell:sp.spells||[],resource:[...(p.resources||[]),...(p.companions||[])]};
    $$('[data-rich-kind]',el).forEach(b=>b.onclick=()=>{const obj=map[b.dataset.richKind]?.[Number(b.dataset.richI)];openDetail(obj?.name||obj?.title||'Details',obj);});
    renderInventoryEnhanced(p);
  }catch{}finally{rendering=false;}
}
function renderInventoryEnhanced(p){
  const root=$('#inventoryContent');if(!root)return;$('#enhancedInventory')?.remove();const items=allInventory(p),e=p.equipment||{};const el=document.createElement('div');el.id='enhancedInventory';el.className='richSection';el.innerHTML=`<h3>Complete Imported Inventory</h3>${listButtons(items,'inventory')}<div class="richGrid" style="margin-top:10px">${stat('Currency',e.currency)}${stat('Carried Weight',e.carriedWeight)}${stat('Carrying Capacity',e.carryingCapacity)}</div>`;root.appendChild(el);$$('[data-rich-kind="inventory"]',el).forEach(b=>b.onclick=()=>{const o=items[Number(b.dataset.richI)];openDetail(o?.name||'Item',o);});
}

const observer=new MutationObserver(()=>setTimeout(renderRich,80));
function init(){installStyles();observer.observe(document.body,{childList:true,subtree:true});renderRich();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();