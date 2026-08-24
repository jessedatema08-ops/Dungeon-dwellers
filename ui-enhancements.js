(()=>{
'use strict';
const $=s=>document.querySelector(s);
const modal=$('#modal'),title=$('#modalTitle'),body=$('#modalBody'),choices=$('#modalChoices'),primary=$('#modalPrimary'),back=$('#modalBack');
if(!modal||!title||!body||!choices||!primary||!back)return;
let bypassAttack=false,bypassSecond=false,bypassComposerAttack=false,pendingSecondButton=null;

function showModal({kicker='Details',heading,html='',choiceButtons=[],primaryText=null,onPrimary=null,backText='Close'}){
  $('#modalKicker').textContent=kicker;title.textContent=heading;body.innerHTML=html;choices.innerHTML='';
  choiceButtons.forEach(({label,meta,onClick,selected=false})=>{const b=document.createElement('button');if(selected)b.classList.add('selectedWeapon');b.innerHTML=`<strong>${label}</strong><span>${meta||''}</span>`;b.addEventListener('click',onClick);choices.appendChild(b);});
  primary.style.display=onPrimary?'block':'none';primary.textContent=primaryText||'Continue';primary.onclick=()=>onPrimary?.();back.textContent=backText;back.onclick=()=>modal.classList.remove('open');modal.classList.add('open');
}

function confirmWeapon(onConfirm,attackLabel='Attack'){
  showModal({
    kicker:attackLabel,
    heading:'Choose your weapon',
    html:'<p>Confirm the weapon for this attack before choosing a target.</p><div class="weaponConfirmNote">Claymore is the only weapon currently available for this attack. Showing it explicitly keeps the choice clear instead of silently forcing it.</div>',
    choiceButtons:[{label:'Claymore',meta:'Greatsword profile · 2d6 Slashing · Heavy · Two-Handed · Graze',selected:true,onClick:()=>{modal.classList.remove('open');onConfirm();}}],
    backText:'Cancel'
  });
}

document.addEventListener('click',e=>{
  const attack=e.target.closest('[data-action="attack"]');
  if(!attack)return;
  if(bypassAttack){bypassAttack=false;return;}
  e.preventDefault();e.stopImmediatePropagation();
  confirmWeapon(()=>{bypassAttack=true;attack.click();},'Attack · Weapon');
},true);

const send=$('[data-action="send-custom"]'),input=$('#customInput');
if(send&&input)send.addEventListener('click',e=>{
  if(bypassComposerAttack){bypassComposerAttack=false;return;}
  const text=input.value.trim();
  const attackIntent=/^(?:i\s+)?(?:attack|strike|shoot|stab|slash|hit)\b|\bi\s+(?:attack|strike|shoot|stab|slash|hit)\b|\bi\s+swing\s+at\b/i.test(text);
  if(!attackIntent)return;
  e.preventDefault();e.stopImmediatePropagation();
  confirmWeapon(()=>{bypassComposerAttack=true;send.click();},'Custom Attack · Weapon');
},true);

choices.addEventListener('click',e=>{
  const btn=e.target.closest('button');if(!btn)return;
  if(!/^Make Second Attack$/i.test((btn.querySelector('strong')?.textContent||btn.textContent).trim()))return;
  if(bypassSecond){bypassSecond=false;return;}
  e.preventDefault();e.stopImmediatePropagation();pendingSecondButton=btn;
  confirmWeapon(()=>{if(pendingSecondButton){bypassSecond=true;const b=pendingSecondButton;pendingSecondButton=null;b.click();}},'Attack 2 · Weapon');
},true);

function openProfile(kind){
  if(kind==='player'){
    showModal({kicker:'Battle Map · Player Character',heading:'Jesse',html:'<div class="mapProfile"><div class="mapProfileAvatar">JD</div><div><h3>Champion Fighter 5</h3><p>Player character · 2024 rules</p></div></div><div class="profileStats"><div class="profileStat"><span>HP</span><strong>38 / 50</strong></div><div class="profileStat"><span>AC</span><strong>18</strong></div><div class="profileStat"><span>Speed</span><strong>30 ft</strong></div><div class="profileStat"><span>Reaction</span><strong>Available</strong></div><div class="profileStat"><span>Conditions</span><strong>None</strong></div><div class="profileStat"><span>Spells</span><strong>None</strong></div></div><p>Key features: Extra Attack, Second Wind, Action Surge, Tactical Mind, Tactical Shift, Improved Critical, Remarkable Athlete.</p>'});
  }else{
    showModal({kicker:'Battle Map · NPC',heading:'Neris',html:'<div class="mapProfile"><div class="mapProfileAvatar">N</div><div><h3>Neris</h3><p>Rescued courier · known ally</p></div></div><div class="profileStats"><div class="profileStat"><span>Trust</span><strong>High</strong></div><div class="profileStat"><span>Fear</span><strong>Low</strong></div><div class="profileStat"><span>Favor</span><strong>Owes one</strong></div></div><p>Known information only: Neris smuggled medicine through the old tunnels and says the Ashen Vault was opened once before, twenty years ago. Unknown NPC stats and secrets remain hidden.</p>'});
  }
}

function setupTokens(){
  const pc=$('#playerToken'),npc=document.querySelector('.token.npc');
  [[pc,'player','Open Jesse character sheet'],[npc,'npc','Open Neris known information']].forEach(([el,kind,label])=>{if(!el)return;el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',label);el.addEventListener('click',()=>openProfile(kind));el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openProfile(kind);}});});
}

function setupMasterMap(){
  const map=document.querySelector('.battlemap');if(!map||map.classList.contains('master-ready'))return;
  map.classList.add('master-ready');
  const canvas=document.createElement('div');canvas.className='masterMapCanvas';
  ['Watch Chapel','Ashen Vault','North Crypts','Old Tunnels','Flooded Cistern','Fallback Route'].forEach((name,i)=>{const z=document.createElement('div');z.className='master-zone '+['zone-chapel','zone-vault','zone-crypt','zone-tunnels','zone-cistern','zone-backup'][i];z.innerHTML=`<span>${name}</span>`;canvas.appendChild(z);});
  [...map.children].forEach(el=>canvas.appendChild(el));map.appendChild(canvas);
  const badge=document.createElement('div');badge.className='mapBadge';badge.innerHTML='<i></i><span>Local vision · master map cached</span>';map.appendChild(badge);
}

function addSystemNote(){
  const grid=document.querySelector('#systemsPage .featureGrid');if(!grid||document.getElementById('masterMapSystem'))return;
  const d=document.createElement('div');d.id='masterMapSystem';d.innerHTML='<strong>Persistent Master Map</strong><span>One large campaign map can stay cached on-device. The battle map is only a moving local viewport with player-specific fog and vision, reducing repeated map transfers while keeping off-course areas ready.</span>';grid.appendChild(d);
}

setupMasterMap();setupTokens();addSystemNote();
})();