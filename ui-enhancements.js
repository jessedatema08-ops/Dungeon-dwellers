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

function setupFinalBottomNav(){
  const nav=document.querySelector('.nav');if(!nav)return;
  nav.innerHTML=`
    <button type="button" data-final-page="scene" class="active" aria-label="Home">
      <span class="finalNavIcon finalHomeIcon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 22.5 24 9l15 13.5V39H29V28H19v11H9Z"/><path d="M16 17V11h6"/></svg></span><span class="finalNavLabel">Home</span>
    </button>
    <button type="button" data-final-page="world" aria-label="Campaign">
      <span class="finalNavIcon finalBookIcon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 11h12c4 0 7 3 7 7v21c0-4-3-7-7-7H8Z"/><path d="M40 11H28c-4 0-7 3-7 7v21c0-4 3-7 7-7h12Z"/></svg></span><span class="finalNavLabel">Campaign</span>
    </button>
    <button type="button" class="finalCenterButton" data-final-action="turn" aria-label="Continue turn">
      <span class="finalNavIcon finalDieIcon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 5 16 10v18L24 43 8 33V15Z"/><path d="m24 5 5 10-5 9-5-9Zm16 10-11 0 5 9 6 9M8 15h11l-5 9-6 9m6-9h20L24 43Zm5-9h10M19 15H9"/></svg></span>
    </button>
    <button type="button" data-final-page="journal" aria-label="NPCs">
      <span class="finalNavIcon finalNpcIcon"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="16" r="8"/><path d="M11 39c1-9 6-14 13-14s12 5 13 14"/><path d="M7 34c1-5 4-8 8-10M41 34c-1-5-4-8-8-10"/></svg></span><span class="finalNavLabel">NPCs</span>
    </button>
    <button type="button" data-final-page="systems" aria-label="More">
      <span class="finalNavIcon finalMoreIcon"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="12" cy="24" r="2.7"/><circle cx="24" cy="24" r="2.7"/><circle cx="36" cy="24" r="2.7"/></svg></span><span class="finalNavLabel">More</span>
    </button>`;

  const style=document.createElement('style');style.id='ddFinalNavStyle';style.textContent=`
    .app{padding-bottom:112px!important}
    .nav{position:fixed!important;top:auto!important;left:50%!important;right:auto!important;bottom:max(10px,env(safe-area-inset-bottom))!important;transform:translateX(-50%)!important;width:min(820px,calc(100% - 24px))!important;height:82px!important;min-height:82px!important;max-height:82px!important;margin:0!important;padding:8px 10px!important;display:grid!important;grid-template-columns:1fr 1fr 88px 1fr 1fr!important;align-items:center!important;gap:4px!important;background:rgba(8,10,14,.96)!important;border:1px solid rgba(210,170,100,.2)!important;border-radius:28px!important;box-shadow:0 20px 50px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.035)!important;backdrop-filter:blur(18px)!important;overflow:visible!important;z-index:999!important}
    .nav button{position:relative!important;min-width:0!important;min-height:62px!important;height:62px!important;padding:4px 2px!important;margin:0!important;border:0!important;border-radius:18px!important;background:transparent!important;color:#8f9094!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;box-shadow:none!important;transform:none!important;overflow:visible!important}
    .nav button:before,.nav button:after{display:none!important;content:none!important}
    .nav button.active{color:#d5ad66!important;background:linear-gradient(180deg,rgba(210,170,100,.08),rgba(210,170,100,.02))!important;box-shadow:inset 0 0 0 1px rgba(210,170,100,.08)!important}
    .finalNavIcon{width:28px;height:28px;display:grid;place-items:center;color:currentColor}
    .finalNavIcon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
    .finalNavLabel{font-size:10px!important;line-height:1!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:currentColor!important;white-space:nowrap!important}
    .nav .finalCenterButton{width:76px!important;height:76px!important;min-height:76px!important;justify-self:center!important;align-self:center!important;transform:translateY(-17px)!important;border-radius:50%!important;background:radial-gradient(circle at 38% 30%,rgba(232,195,122,.2),rgba(30,25,16,.95) 58%,rgba(10,11,14,.98) 76%)!important;border:1px solid rgba(220,181,105,.48)!important;box-shadow:0 0 0 7px rgba(7,9,12,.96),0 0 0 8px rgba(210,170,100,.13),0 12px 28px rgba(0,0,0,.62),inset 0 0 18px rgba(210,170,100,.12)!important;color:#d8b16b!important}
    .nav .finalCenterButton .finalNavIcon{width:43px;height:43px}
    .nav .finalCenterButton:active{transform:translateY(-15px) scale(.97)!important}
    .nav button:not(.finalCenterButton):active{background:rgba(210,170,100,.08)!important}
    @media(max-width:520px){
      .app{padding-bottom:104px!important}
      .nav{left:8px!important;right:8px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;transform:none!important;width:auto!important;height:76px!important;min-height:76px!important;max-height:76px!important;grid-template-columns:1fr 1fr 76px 1fr 1fr!important;padding:6px 7px!important;border-radius:24px!important}
      .nav button{height:58px!important;min-height:58px!important;gap:4px!important}
      .finalNavIcon{width:25px;height:25px}
      .finalNavLabel{font-size:9px!important;letter-spacing:.04em!important}
      .nav .finalCenterButton{width:68px!important;height:68px!important;min-height:68px!important;transform:translateY(-15px)!important}
      .nav .finalCenterButton .finalNavIcon{width:39px;height:39px}
    }
  `;document.head.appendChild(style);

  const openPage=page=>{
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===page+'Page'));
    nav.querySelectorAll('[data-final-page]').forEach(b=>b.classList.toggle('active',b.dataset.finalPage===page));
    window.scrollTo({top:0,behavior:'smooth'});
  };
  nav.querySelectorAll('[data-final-page]').forEach(btn=>btn.addEventListener('click',()=>openPage(btn.dataset.finalPage)));
  nav.querySelector('[data-final-action="turn"]')?.addEventListener('click',()=>{
    openPage('scene');
    setTimeout(()=>document.getElementById('customInput')?.focus(),180);
  });
}

setupMasterMap();setupTokens();addSystemNote();setupFinalBottomNav();
})();