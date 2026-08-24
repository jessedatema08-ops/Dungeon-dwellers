(()=>{
'use strict';
const WORKER_URL='https://dungeon-dwellers-ai.jesse-datema08.workers.dev';
const sendBtn=document.querySelector('[data-action="send-custom"]');
const input=document.getElementById('customInput');
const notice=document.getElementById('sceneNotice');
const status=document.getElementById('campaignStatus');
if(!sendBtn||!input||!notice)return;

let pendingRoll=null;

function getCampaignState(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('ddBetaV4')||'{}')}catch{}
  return {
    app:'Dungeon Dwellers',
    campaign:'The Ashen Vault',
    chapter:4,
    player:{name:'Jesse',class:'Fighter',subclass:'Champion',level:5},
    rulesEdition:'D&D 5e 2024 revised',
    timers:{combatTurnHours:6,reactionWindowHours:1,combatRoundSeconds:6},
    scene:{
      location:'Sealed burial chamber beneath the ruined watch chapel',
      northDoor:'Bronze door with unreadable inscription',
      west:'Collapsed shrine',
      knownNPCs:['Neris'],
      visibleThreats:['Unknown Creature']
    },
    pendingRoll,
    localState:saved
  };
}

function getNarration(payload){
  if(!payload)return 'The AI DM returned no response.';
  if(typeof payload==='string')return payload;
  if(typeof payload.narration==='string')return payload.narration;
  if(payload.dm&&typeof payload.dm.narration==='string')return payload.dm.narration;
  if(typeof payload.response==='string')return payload.response;
  if(typeof payload.result==='string')return payload.result;
  if(payload.result&&typeof payload.result.response==='string')return payload.result.response;
  if(payload.result&&typeof payload.result.narration==='string')return payload.result.narration;
  return JSON.stringify(payload);
}

async function parseResponse(res){
  const text=await res.text();
  let data;
  try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  if(!res.ok||data?.ok===false){
    const detail=data?.error||data?.message||data?.raw||`HTTP ${res.status}`;
    throw new Error(String(detail));
  }
  return data;
}

async function checkAI(){
  try{
    const res=await fetch(`${WORKER_URL}/`,{method:'GET',cache:'no-store'});
    const data=await parseResponse(res);
    if(data?.ok){if(status)status.textContent='AI DM online';return true;}
  }catch(err){console.warn('AI health check failed',err);}
  if(status)status.textContent='AI DM offline';
  return false;
}

async function askAI(message){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const res=await fetch(`${WORKER_URL}/`,{
      method:'POST',mode:'cors',cache:'no-store',credentials:'omit',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({message,campaignState:getCampaignState()}),
      signal:controller.signal
    });
    return await parseResponse(res);
  }finally{clearTimeout(timeout);}
}

function impossibleClaim(text){
  const dieClaim=/(?:rolled|roll|got|result(?:ed)?(?: in)?|came up)\s+(\d+)\s+(?:on\s+)?(?:a\s+)?d(4|6|8|10|12|20|100)\b/i.exec(text);
  if(dieClaim){
    const value=Number(dieClaim[1]),sides=Number(dieClaim[2]);
    if(value<1||value>sides)return `A d${sides} can only roll 1-${sides}. A claimed ${value} is invalid.`;
  }
  const reverse=/d(4|6|8|10|12|20|100)\s+(?:roll(?:ed)?|was|=|of)?\s*(\d+)/i.exec(text);
  if(reverse){
    const sides=Number(reverse[1]),value=Number(reverse[2]);
    if(value<1||value>sides)return `A d${sides} can only roll 1-${sides}. A claimed ${value} is invalid.`;
  }
  return null;
}

function detectRollRequest(text){
  if(!text)return null;
  const lower=text.toLowerCase();
  const asksRoll=/(make|roll|give me|attempt|perform).{0,35}(attack roll|damage roll|saving throw|save|ability check|skill check|initiative|concentration|death save|d20|d4|d6|d8|d10|d12|d100)/i.test(text)
    || /\broll\s+\d*d(?:4|6|8|10|12|20|100)\b/i.test(text);
  if(!asksRoll)return null;

  let label='Roll';
  if(lower.includes('attack roll'))label='Attack Roll';
  else if(lower.includes('damage roll'))label='Damage Roll';
  else if(lower.includes('saving throw')||/\bsave\b/.test(lower))label='Saving Throw';
  else if(lower.includes('ability check')||lower.includes('skill check'))label='Ability Check';
  else if(lower.includes('initiative'))label='Initiative';
  else if(lower.includes('concentration'))label='Concentration Save';
  else if(lower.includes('death save'))label='Death Save';

  const dice=/\b(\d{0,2})d(4|6|8|10|12|20|100)(?:\s*([+-])\s*(\d+))?/i.exec(text);
  if(dice){
    const count=Math.max(1,Math.min(20,Number(dice[1]||1)));
    const sides=Number(dice[2]);
    const mod=dice[3]?(dice[3]==='-'?-1:1)*Number(dice[4]||0):0;
    return {label,count,sides,mod,expression:`${count}d${sides}${mod?`${mod>0?'+':''}${mod}`:''}`,source:text};
  }

  if(label!=='Damage Roll')return {label,count:1,sides:20,mod:0,expression:'1d20',source:text};
  return {label,count:null,sides:null,mod:0,expression:null,source:text,needsDice:true};
}

function ensureRollUI(){
  if(document.getElementById('aiRollOverlay'))return;
  const style=document.createElement('style');
  style.textContent=`#aiRollOverlay{position:fixed;inset:0;background:rgba(4,6,9,.88);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px}#aiRollOverlay.open{display:flex}#aiRollCard{width:min(92vw,430px);background:#0d1217;border:1px solid #39414b;border-radius:16px;padding:20px;color:#e8ebef;font-family:Inter,system-ui,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.55)}#aiRollKicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8f96a0}#aiRollTitle{margin:6px 0 8px;font:700 25px Georgia,serif}#aiRollExpr{font-size:13px;color:#9ea5ae;margin-bottom:14px}#aiRollDie{font:700 54px Georgia,serif;text-align:center;padding:20px 0}#aiRollMath{font-size:13px;color:#b8bec6;text-align:center;min-height:22px;margin-bottom:14px}#aiRollBtn{width:100%;min-height:50px;border:1px solid #535d69;border-radius:12px;background:#161c23;color:#fff;font-weight:700}#aiRollHint{margin-top:10px;font-size:12px;color:#7f8792;text-align:center}`;
  document.head.appendChild(style);
  const overlay=document.createElement('div');
  overlay.id='aiRollOverlay';
  overlay.innerHTML='<div id="aiRollCard"><div id="aiRollKicker">Player Roll Required</div><div id="aiRollTitle">Roll</div><div id="aiRollExpr"></div><div id="aiRollDie">—</div><div id="aiRollMath"></div><button id="aiRollBtn" type="button">Roll in App</button><div id="aiRollHint">Typed roll results are not accepted while this roll is pending.</div></div>';
  document.body.appendChild(overlay);
  document.getElementById('aiRollBtn').addEventListener('click',performPendingRoll);
}

function openRollPrompt(roll){
  ensureRollUI();
  pendingRoll=roll;
  document.getElementById('aiRollTitle').textContent=roll.label;
  document.getElementById('aiRollExpr').textContent=roll.needsDice?'The AI must specify the exact damage dice before this can be rolled.':roll.expression;
  document.getElementById('aiRollDie').textContent='—';
  document.getElementById('aiRollMath').textContent='';
  const btn=document.getElementById('aiRollBtn');
  btn.disabled=!!roll.needsDice;
  btn.textContent=roll.needsDice?'Waiting for exact dice':'Roll in App';
  document.getElementById('aiRollOverlay').classList.add('open');
  if(roll.needsDice)requestExactDamageDice();
}

async function requestExactDamageDice(){
  try{
    const payload=await askAI('You required a damage roll but did not specify the dice. State the exact damage dice expression only, such as 2d6+4. Do not resolve the roll.');
    const text=getNarration(payload);
    const found=detectRollRequest(`roll ${text}`);
    if(found&&found.expression){openRollPrompt({...found,label:'Damage Roll'});return;}
    notice.textContent=`AI DM: ${text}`;
  }catch(err){notice.textContent=`AI DM error: ${err?.message||String(err)}`;}
}

async function performPendingRoll(){
  if(!pendingRoll||pendingRoll.needsDice)return;
  const btn=document.getElementById('aiRollBtn'),die=document.getElementById('aiRollDie'),math=document.getElementById('aiRollMath');
  btn.disabled=true;btn.textContent='Rolling';
  let ticks=0;
  const spin=setInterval(()=>{die.textContent=String(Math.floor(Math.random()*pendingRoll.sides)+1);if(++ticks>14){clearInterval(spin);finish();}},70);
  async function finish(){
    const rolls=Array.from({length:pendingRoll.count},()=>Math.floor(Math.random()*pendingRoll.sides)+1);
    const total=rolls.reduce((a,b)=>a+b,0)+pendingRoll.mod;
    die.textContent=pendingRoll.count===1?String(rolls[0]):rolls.join(' + ');
    math.textContent=`${pendingRoll.expression} = ${total}`;
    const completed={...pendingRoll,rolls,total};
    pendingRoll=null;
    btn.textContent='Sending result to AI DM';
    try{
      const payload=await askAI(`APP_VERIFIED_ROLL: ${completed.label}; dice ${completed.expression}; raw rolls [${rolls.join(', ')}]; total ${total}. This result was generated by the app and is authoritative. Continue adjudication from this roll. Do not ask the player to type or invent a roll result.`);
      const narration=getNarration(payload);
      notice.textContent=`AI DM: ${narration}`;
      document.getElementById('aiRollOverlay').classList.remove('open');
      const next=detectRollRequest(narration);
      if(next)setTimeout(()=>openRollPrompt(next),250);
      if(status)status.textContent='AI DM online';
    }catch(err){
      math.textContent+=` · AI error: ${err?.message||String(err)}`;
      btn.disabled=false;btn.textContent='Retry sending result';
      pendingRoll=completed;
    }
  }
}

async function handleMessage(message){
  if(pendingRoll){
    notice.textContent='A player roll is pending. Use the Roll in App button; typed roll results are not accepted.';
    return;
  }
  const invalid=impossibleClaim(message);
  if(invalid){notice.textContent=`Roll rejected: ${invalid} Use the app's roll prompt instead.`;return;}

  sendBtn.disabled=true;
  notice.textContent='AI DM is thinking…';
  if(status)status.textContent='AI DM thinking';
  try{
    const payload=await askAI(message);
    const narration=getNarration(payload);
    notice.textContent=`AI DM: ${narration}`;
    if(status)status.textContent='AI DM online';
    window.dispatchEvent(new CustomEvent('dungeon-dwellers-ai-response',{detail:payload}));
    const roll=detectRollRequest(narration);
    if(roll)setTimeout(()=>openRollPrompt(roll),250);
  }catch(err){
    console.error('Dungeon Dwellers AI error',err);
    const msg=err?.name==='AbortError'?'Request timed out after 45 seconds.':(err?.message||String(err));
    notice.textContent=`AI DM error: ${msg}`;
    if(status)status.textContent='AI DM offline';
  }finally{sendBtn.disabled=false;}
}

sendBtn.addEventListener('click',async(ev)=>{
  ev.preventDefault();ev.stopImmediatePropagation();
  const message=input.value.trim();
  if(!message)return;
  input.value='';
  await handleMessage(message);
},true);

input.addEventListener('keydown',(ev)=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();sendBtn.click();}});

ensureRollUI();
checkAI();
})();
