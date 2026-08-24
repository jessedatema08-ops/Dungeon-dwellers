(()=>{
'use strict';

const qs=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const db=()=>window.DungeonDB;
const ai=()=>window.DungeonAI;

function localDateTimeValue(d){
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function modalHtml(title,body,buttons=''){
  const root=qs('#modalRoot');
  if(!root)return null;
  root.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="eyebrow">Campaign Owner</div><h2>${esc(title)}</h2><div class="modalBody">${body}</div><div class="buttonRow" style="margin-top:14px">${buttons}</div></div></div>`;
  root.classList.remove('hidden');
  return root;
}
function closeModal(){const root=qs('#modalRoot');if(root){root.classList.add('hidden');root.innerHTML='';}}

function parseCampaignJson(text){
  let src=String(text||'').replace(/\[\[DD_EVENT:[\s\S]*?\]\]/g,'').trim();
  const fenced=src.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fenced)src=fenced[1].trim();
  const first=src.indexOf('{'),last=src.lastIndexOf('}');
  if(first<0||last<=first)throw new Error('The AI did not return campaign data.');
  return JSON.parse(src.slice(first,last+1));
}

function fallbackCampaign(){
  const options=[
    {
      name:'The Choir Beneath Glass',sceneTitle:'A City That Sings at Midnight',
      sceneText:'At the exact stroke of midnight, every window in the hill-city turns black from the inside. Then the glass begins to sing. The notes are not random: they form a slow, repeating melody that older residents refuse to acknowledge. By dawn, one entire street has vanished behind a wall of perfectly clear crystal. Trapped silhouettes move on the other side, but their shadows point toward a sun that does not exist. A child slips the party a brass tuning fork and whispers that the song is getting closer to their names.',
      quests:[{title:'The Missing Street',summary:'Find a way through the crystal wall before the trapped district disappears completely.'},{title:'Names in the Song',summary:'Learn why the midnight melody has begun weaving the party into its refrain.'}],
      knowledge:['The glass-singing began only three nights ago.','Old maps show a buried observatory directly beneath the vanished street.'],
      npcs:[{key:'sella-vane',name:'Sella Vane',role:'apprentice glazier',public:'Claims her master predicted the crystal wall years ago.'}],theme:'crystal-noir'
    },
    {
      name:'The Moon That Sank',sceneTitle:'Low Tide Under a Broken Sky',
      sceneText:'The moon falls from the sky without a sound and comes to rest half-submerged in a salt marsh twenty miles inland. It is far smaller than it should be, no larger than a fortress, and a staircase is carved into its silver surface. By morning, rival pilgrims, scholars, smugglers, and soldiers have surrounded it. Then the first person to climb the stairs returns carrying a memory that belongs to someone else in the crowd. Before sunset, the moon opens a door.',
      quests:[{title:'Inside the Fallen Moon',summary:'Enter the impossible structure before one of the factions seals it off.'},{title:'Borrowed Memories',summary:'Discover why the moon is exchanging memories among those nearby.'}],
      knowledge:['The tides have stopped moving since the moon fell.','No known divination can determine whether the object is truly the moon.'],
      npcs:[{key:'orren-kale',name:'Orren Kale',role:'disgraced astronomer',public:'Insists the object has been waiting for someone specific.'}],theme:'fallen-moon'
    },
    {
      name:'Ashes of the Ninth Orchard',sceneTitle:'Fruit From a Dead Season',
      sceneText:'A caravan arrives carrying fruit from an orchard that burned to the ground seventy years ago. Each black-skinned pear contains a tiny moving scene from the past, visible through its translucent flesh. One shows a murder no history records. Another shows a member of the party standing beneath the orchard trees decades before they were born. The merchant who brought them swears he never loaded the crates, and every road leading out of town now ends at the same scorched gate.',
      quests:[{title:'The Ninth Orchard',summary:'Find the impossible orchard and learn why it has returned.'},{title:'A Life Before Birth',summary:'Investigate the vision connecting a party member to events seventy years ago.'}],
      knowledge:['Eight royal orchards are documented; there was never officially a ninth.','Eating the fruit causes vivid dreams but no known poison.'],
      npcs:[{key:'mora-denn',name:'Mora Denn',role:'terrified caravan master',public:'Wants the crates destroyed but cannot explain why she knows what is inside them.'}],theme:'haunted-orchard'
    }
  ];
  return options[Math.floor(Math.random()*options.length)];
}

async function generateCampaign({scheduledStart,sleepStart,sleepEnd,timezone}){
  const DB=db();if(!DB)throw new Error('Database is unavailable.');
  const temp=await DB.createCampaign(`Generating Campaign ${Math.floor(Math.random()*99999)}`);
  const cid=temp.id;
  const client=DB.client;

  try{
    const startIso=new Date(scheduledStart).toISOString();
    const {error:scheduleError}=await client.from('campaigns').update({
      scheduled_start:startIso,
      sleep_start:sleepStart,
      sleep_end:sleepEnd,
      schedule_timezone:timezone,
      schedule_paused:true,
      schedule_pause_started_at:new Date().toISOString(),
      paused:true
    }).eq('id',cid);
    if(scheduleError)throw scheduleError;

    const seed=crypto.randomUUID();
    const prompt=`CAMPAIGN_GENERATION_REQUEST\nCreate one completely original, intriguing D&D 5e 2024 campaign for asynchronous play. Make it vivid, surprising, playable, and unlike stock fantasy. Vary the genre, mystery, location, factions, threat, moral tension, and imagery. Do not reuse The Ashen Vault. Avoid copyrighted settings and characters. Seed: ${seed}.\n\nReturn ONLY valid JSON, no markdown, no commentary, using exactly this shape:\n{\n  "name":"short memorable campaign title",\n  "sceneTitle":"opening scene title",\n  "sceneText":"120-220 word atmospheric opening that gives the players an immediate meaningful situation",\n  "quests":[{"title":"...","summary":"..."},{"title":"...","summary":"..."}],\n  "knowledge":["2-4 short facts known to the party"],\n  "npcs":[{"key":"lowercase-key","name":"...","role":"...","public":"brief known description"}],\n  "theme":"short visual map theme"\n}`;

    let g;
    try{
      const result=await ai().ask(prompt,{campaign:{id:cid},campaignId:cid});
      g=parseCampaignJson(result?.narration||'');
    }catch(err){
      console.warn('AI campaign generation fell back to local seed.',err);
      g=fallbackCampaign();
    }

    const name=String(g.name||'Unnamed Adventure').slice(0,120);
    const sceneTitle=String(g.sceneTitle||'Opening Scene').slice(0,160);
    const sceneText=String(g.sceneText||'The adventure begins.').slice(0,6000);

    let res=await client.from('campaigns').update({
      name,chapter:1,current_scene:sceneText,
      state:{sceneTitle,sceneText,scene_turn_number:1,generatedByAI:true,generationSeed:seed},
      settings:{combatTurnHours:6,reactionWindowHours:1,sceneTurnHours:24,initiativeStyle:'initiative_blocks'}
    }).eq('id',cid);
    if(res.error)throw res.error;

    const quests=Array.isArray(g.quests)?g.quests.slice(0,5):[];
    if(quests.length){res=await client.from('quests').insert(quests.map(q=>({campaign_id:cid,title:String(q.title||'Quest').slice(0,160),status:'active',data:{summary:String(q.summary||'').slice(0,1200)}})));if(res.error)throw res.error;}

    const facts=Array.isArray(g.knowledge)?g.knowledge.slice(0,8):[];
    if(facts.length){res=await client.from('knowledge').insert(facts.map(f=>({campaign_id:cid,user_id:null,visibility:'party',fact:String(f).slice(0,1200)})));if(res.error)throw res.error;}

    const npcs=Array.isArray(g.npcs)?g.npcs.slice(0,8):[];
    if(npcs.length){
      res=await client.from('npc_state').insert(npcs.map((n,i)=>({campaign_id:cid,npc_key:String(n.key||`npc-${i+1}`).slice(0,80),public_state:{name:String(n.name||'Unknown'),role:String(n.role||'NPC'),description:String(n.public||'')},hidden_state:{}})));if(res.error)throw res.error;
      res=await client.from('tokens').insert(npcs.map((n,i)=>({campaign_id:cid,token_type:'npc',name:String(n.name||'NPC').slice(0,120),x:18+((i*17)%64),y:24+((i*19)%52),hidden:false,state:{role:String(n.role||'NPC')}})));if(res.error)throw res.error;
    }

    res=await client.from('campaign_maps').insert({campaign_id:cid,name:`${name} · Opening Map`,active:true,generated_spec:{name:`${name} · Opening Map`,theme:String(g.theme||'mysterious'),rooms:[{x:8,y:12,w:35,h:32},{x:53,y:20,w:38,h:26},{x:22,y:58,w:50,h:30}]}});if(res.error)throw res.error;
    await DB.addStory(cid,'campaign_generated',{summary:`The AI generated ${name}.`,seed});
    await client.rpc('dd_apply_campaign_schedules');

    localStorage.setItem('ddPreferredCampaign',cid);
    return {id:cid,name};
  }catch(err){
    await client.from('campaigns').delete().eq('id',cid);
    throw err;
  }
}

function openCreateCampaign(){
  const start=new Date(Date.now()+30*60*1000);
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const body=`<p class="statusLine">The AI will invent the title, setting, opening mystery, quests, NPCs, and opening map. Every campaign is generated from a fresh random seed.</p>
  <div class="formGrid" style="margin-top:10px">
    <label class="fieldLabel">Scheduled campaign start<input id="ddCampaignStart" type="datetime-local" value="${localDateTimeValue(start)}"></label>
    <div class="grid2">
      <label class="fieldLabel">Daily sleep pause starts<input id="ddSleepStart" type="time" value="23:00"></label>
      <label class="fieldLabel">Daily sleep pause ends<input id="ddSleepEnd" type="time" value="07:00"></label>
    </div>
    <label class="fieldLabel">Time zone<input id="ddScheduleTimezone" value="${esc(tz)}"></label>
    <div id="ddCampaignGenStatus" class="statusLine">Turn timers freeze during the daily sleep window, so nobody loses time while the group is asleep.</div>
  </div>`;
  modalHtml('Generate New Campaign',body,'<button id="ddCancelCampaign" class="ghostBtn">Cancel</button><button id="ddGenerateCampaign" class="goldBtn">Generate Campaign</button>');
  qs('#ddCancelCampaign').onclick=closeModal;
  qs('#ddGenerateCampaign').onclick=async()=>{
    const btn=qs('#ddGenerateCampaign'),status=qs('#ddCampaignGenStatus');
    const scheduledStart=qs('#ddCampaignStart').value,sleepStart=qs('#ddSleepStart').value,sleepEnd=qs('#ddSleepEnd').value,timezone=qs('#ddScheduleTimezone').value.trim()||tz;
    if(!scheduledStart||!sleepStart||!sleepEnd){status.textContent='Choose a start time and both sleep-pause times.';status.className='statusLine bad';return;}
    try{
      btn.disabled=true;status.textContent='AI is inventing a new campaign...';status.className='statusLine warn';
      const made=await generateCampaign({scheduledStart,sleepStart,sleepEnd,timezone});
      status.textContent=`Created ${made.name}. Opening campaign...`;status.className='statusLine ok';
      setTimeout(()=>location.reload(),350);
    }catch(err){btn.disabled=false;status.textContent=err.message||String(err);status.className='statusLine bad';}
  };
}

async function openScheduleEditor(){
  const id=localStorage.getItem('ddPreferredCampaign');if(!id)return;
  const c=await db().campaign(id);
  const start=c.scheduled_start?new Date(c.scheduled_start):new Date();
  const body=`<div class="formGrid">
    <label class="fieldLabel">Scheduled campaign start<input id="ddEditStart" type="datetime-local" value="${localDateTimeValue(start)}"></label>
    <div class="grid2"><label class="fieldLabel">Sleep pause starts<input id="ddEditSleepStart" type="time" value="${String(c.sleep_start||'23:00').slice(0,5)}"></label><label class="fieldLabel">Sleep pause ends<input id="ddEditSleepEnd" type="time" value="${String(c.sleep_end||'07:00').slice(0,5)}"></label></div>
    <label class="fieldLabel">Time zone<input id="ddEditTz" value="${esc(c.schedule_timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC')}"></label>
    <div id="ddEditScheduleStatus" class="statusLine">Changing the sleep window changes when campaign timers automatically freeze each day.</div>
  </div>`;
  modalHtml('Campaign Schedule',body,'<button id="ddEditScheduleCancel" class="ghostBtn">Cancel</button><button id="ddEditScheduleSave" class="goldBtn">Save Schedule</button>');
  qs('#ddEditScheduleCancel').onclick=closeModal;
  qs('#ddEditScheduleSave').onclick=async()=>{
    const status=qs('#ddEditScheduleStatus');
    try{
      const patch={scheduled_start:new Date(qs('#ddEditStart').value).toISOString(),sleep_start:qs('#ddEditSleepStart').value,sleep_end:qs('#ddEditSleepEnd').value,schedule_timezone:qs('#ddEditTz').value.trim()||'UTC'};
      const {error}=await db().client.from('campaigns').update(patch).eq('id',id);if(error)throw error;
      await db().client.rpc('dd_apply_campaign_schedules');
      closeModal();location.reload();
    }catch(err){status.textContent=err.message||String(err);status.className='statusLine bad';}
  };
}

function ensureScheduleButton(){
  const ownerPanel=qs('#ownerPanel .buttonRow');
  if(ownerPanel&&!qs('#ddEditScheduleBtn')){
    const b=document.createElement('button');b.id='ddEditScheduleBtn';b.className='ghostBtn';b.textContent='Campaign Schedule';b.onclick=openScheduleEditor;ownerPanel.appendChild(b);
  }
}

async function refreshScheduleBadge(){
  const id=localStorage.getItem('ddPreferredCampaign');if(!id||!db())return;
  try{
    const c=await db().campaign(id),timer=qs('#turnTimer');if(!timer)return;
    const start=c.scheduled_start?new Date(c.scheduled_start):null;
    if(start&&start>Date.now()){
      timer.textContent=`Scheduled start · ${start.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;
    }else if(c.schedule_paused){
      timer.textContent=`Sleep pause · resumes ${String(c.sleep_end||'07:00').slice(0,5)}`;
    }
  }catch{}
}

document.addEventListener('click',e=>{
  const t=e.target.closest?.('#lobbyCreate,#newCampaignBtn,#newCampaignBtnDuplicate');
  if(!t)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openCreateCampaign();
},true);

const observer=new MutationObserver(()=>ensureScheduleButton());
observer.observe(document.documentElement,{childList:true,subtree:true});
ensureScheduleButton();
setInterval(refreshScheduleBadge,1500);

window.DungeonCampaignGenerator={openCreateCampaign,openScheduleEditor,generateCampaign};
})();