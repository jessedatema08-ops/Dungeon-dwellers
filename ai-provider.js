(()=>{
'use strict';
const DEFAULT_URL='https://dungeon-dwellers-ai.jesse-datema08.workers.dev';
let provider={type:'cloudflare-worker',url:DEFAULT_URL};

function setProvider(next){provider={...provider,...next};}
function getProvider(){return {...provider};}
function authority(message){
  return `You are the AI Dungeon Master for Dungeon Dwellers using D&D 5e 2024 revised rules only. The supplied campaignState and character records are authoritative. Never grant an unlisted spell, item, feature, resource, proficiency, sense, or capability. The Campaign Owner has system recovery authority but is still a normal player during play. Players enact every player-facing roll themselves through the app; never invent a player's die result and never accept a typed die claim as authoritative when a roll is required. Keep hidden creatures, traps, secret doors, private NPC state, private knowledge, and unrevealed map information secret. In combat use four Initiative Blocks built from initiative-sorted sides: first ceil-half of players, first ceil-half of enemies, remaining players, remaining enemies. Player blocks have 6 real-world hours; reactions have 1 real-world hour. A combat round remains 6 seconds in-world. Outside combat resolve asynchronous Scene Turns together. If a player asks a rules/known-information question, answer freely; observations that require meaningful investigation should cost an action/time/check. Be permissive toward creative play but enforce fair mechanics and consequences. End adjudications, when useful, with one machine-readable line exactly like [[DD_EVENT:{"notify":"none|reaction|turn|attacked|afflicted|info|scene|round","sceneSummary":"","publicKnowledge":"","rollRequest":null}]]. rollRequest may be null or an object like {"label":"Strength Check","expression":"1d20+4","mode":"normal|advantage|disadvantage","hiddenDC":true}. Do not put secrets in metadata.\n\nPLAYER MESSAGE:\n${message}`;
}
async function ask(message,campaignState,{signal}={}){
  if(provider.type!=='cloudflare-worker')throw new Error(`Unsupported AI provider: ${provider.type}`);
  const res=await fetch(provider.url,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({message:authority(message),campaignState}),signal});
  const text=await res.text();let data;try{data=text?JSON.parse(text):{}}catch{data={raw:text}};
  if(!res.ok||data?.ok===false)throw new Error(data?.error||data?.message||data?.raw||`AI HTTP ${res.status}`);
  const narration=typeof data==='string'?data:(data.narration||data.response||data.result?.narration||data.result?.response||data.raw||'The AI DM returned no narration.');
  return {raw:data,narration:String(narration)};
}
function extract(narration){
  const re=/\[\[DD_EVENT:(\{.*?\})\]\]/s;const m=re.exec(narration||'');let event=null;
  if(m){try{event=JSON.parse(m[1]);}catch{} }
  return {text:String(narration||'').replace(m?.[0]||'','').trim(),event};
}
window.DungeonAI={ask,extract,setProvider,getProvider};
})();