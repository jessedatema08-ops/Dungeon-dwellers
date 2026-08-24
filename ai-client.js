(()=>{
'use strict';
const WORKER_URL='https://dungeon-dwellers-ai.jesse-datema08.workers.dev/';
const sendBtn=document.querySelector('[data-action="send-custom"]');
const input=document.getElementById('customInput');
const notice=document.getElementById('sceneNotice');
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
  if(typeof payload.response==='string')return payload.response;
  if(typeof payload.result==='string')return payload.result;
  if(payload.result&&typeof payload.result.response==='string')return payload.result.response;
  if(payload.result&&typeof payload.result.narration==='string')return payload.result.narration;
  return JSON.stringify(payload);
}

async function askAI(message){
  const res=await fetch(WORKER_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message,campaignState:getCampaignState()})
  });
  if(!res.ok){
    const text=await res.text().catch(()=> '');
    throw new Error(`Worker returned ${res.status}${text?`: ${text.slice(0,180)}`:''}`);
  }
  return res.json();
}

sendBtn.addEventListener('click',async(ev)=>{
  ev.preventDefault();
  ev.stopImmediatePropagation();
  const message=input.value.trim();
  if(!message)return;
  input.value='';
  sendBtn.disabled=true;
  notice.textContent='AI DM is thinking…';
  try{
    const payload=await askAI(message);
    notice.textContent=`AI DM: ${getNarration(payload)}`;
    window.dispatchEvent(new CustomEvent('dungeon-dwellers-ai-response',{detail:payload}));
  }catch(err){
    console.error(err);
    notice.textContent='AI DM connection failed. Check the Cloudflare Worker deployment, Workers AI binding, and CORS settings.';
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
})();
