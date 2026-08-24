(()=>{
'use strict';
const WORKER_URL='https://dungeon-dwellers-ai.jesse-datema08.workers.dev';
const sendBtn=document.querySelector('[data-action="send-custom"]');
const input=document.getElementById('customInput');
const notice=document.getElementById('sceneNotice');
const status=document.getElementById('campaignStatus');
if(!sendBtn||!input||!notice)return;

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
    if(data?.ok){
      if(status)status.textContent='AI DM online';
      return true;
    }
  }catch(err){
    console.warn('AI health check failed',err);
  }
  if(status)status.textContent='AI DM offline';
  return false;
}

async function askAI(message){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const res=await fetch(`${WORKER_URL}/`,{
      method:'POST',
      mode:'cors',
      cache:'no-store',
      credentials:'omit',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({message,campaignState:getCampaignState()}),
      signal:controller.signal
    });
    return await parseResponse(res);
  }finally{
    clearTimeout(timeout);
  }
}

sendBtn.addEventListener('click',async(ev)=>{
  ev.preventDefault();
  ev.stopImmediatePropagation();
  const message=input.value.trim();
  if(!message)return;
  input.value='';
  sendBtn.disabled=true;
  notice.textContent='AI DM is thinking…';
  if(status)status.textContent='AI DM thinking';
  try{
    const payload=await askAI(message);
    notice.textContent=`AI DM: ${getNarration(payload)}`;
    if(status)status.textContent='AI DM online';
    window.dispatchEvent(new CustomEvent('dungeon-dwellers-ai-response',{detail:payload}));
  }catch(err){
    console.error('Dungeon Dwellers AI error',err);
    const message=err?.name==='AbortError'?'Request timed out after 45 seconds.':(err?.message||String(err));
    notice.textContent=`AI DM error: ${message}`;
    if(status)status.textContent='AI DM offline';
  }finally{
    sendBtn.disabled=false;
  }
},true);

input.addEventListener('keydown',(ev)=>{
  if(ev.key==='Enter'&&!ev.shiftKey){
    ev.preventDefault();
    sendBtn.click();
  }
});

checkAI();
})();
