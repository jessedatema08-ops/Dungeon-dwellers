import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUSH_SECRET=Deno.env.get('DD_PUSH_SECRET')||'';
const AI_URL=Deno.env.get('DD_AI_URL')||'https://dungeon-dwellers-ai.jesse-datema08.workers.dev';
const supabase=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
const SEQ=['player_1','enemy_1','player_2','enemy_2'];
const INDEX:Record<string,number>={player_1:1,enemy_1:2,player_2:3,enemy_2:4};

async function push(campaign_id:string,user_ids:string[],type:string,title:string,body:string){
  if(!user_ids.length||!PUSH_SECRET)return;
  await fetch(`${SUPABASE_URL}/functions/v1/push-dispatch`,{method:'POST',headers:{'Content-Type':'application/json','x-dd-push-secret':PUSH_SECRET},body:JSON.stringify({campaign_id,user_ids,type,title,body,url:'https://jessedatema08-ops.github.io/Dungeon-dwellers/'})});
}
async function usersForBlock(campaignId:string,block:string){
  const idx=INDEX[block];if(!idx)return [];
  const {data}=await supabase.from('initiative_entries').select('user_id').eq('campaign_id',campaignId).eq('block_index',idx).eq('side','player').eq('defeated',false);
  return [...new Set((data||[]).map(x=>x.user_id).filter(Boolean))] as string[];
}
async function advance(c:any){
  const i=SEQ.indexOf(c.active_block);const next=SEQ[(i+1+SEQ.length)%SEQ.length];let round=c.round_number||1;if(next==='player_1')round++;
  const deadline=next.startsWith('player')?new Date(Date.now()+6*3600000).toISOString():new Date(Date.now()+5*60000).toISOString();
  const state={...(c.state||{}),notificationMarks:{}};
  await supabase.from('campaigns').update({active_block:next,round_number:round,active_deadline:deadline,deadline_type:next.startsWith('player')?'combat_block':'enemy_resolution',state,updated_at:new Date().toISOString()}).eq('id',c.id);
  if(next.startsWith('player')){const users=await usersForBlock(c.id,next);await push(c.id,users,'turn_open','Your Initiative Block Is Open',`${next==='player_1'?'First':'Second'} player block is open for 6 hours.`);}
}
async function resolveEnemyBlock(c:any){
  const lock=c.state?.enemy_resolution_lock;if(lock&&Date.now()-new Date(lock).getTime()<4*60000)return;
  await supabase.from('campaigns').update({state:{...(c.state||{}),enemy_resolution_lock:new Date().toISOString()}}).eq('id',c.id);
  const [{data:initiative},{data:tokens},{data:chars},{data:events}]=await Promise.all([
    supabase.from('initiative_entries').select('*').eq('campaign_id',c.id).eq('defeated',false),
    supabase.from('tokens').select('*').eq('campaign_id',c.id),
    supabase.from('characters').select('id,name,hp,max_hp,ac,profile').eq('campaign_id',c.id),
    supabase.from('story_events').select('*').eq('campaign_id',c.id).order('created_at',{ascending:false}).limit(15)
  ]);
  const message=`Resolve ${c.active_block} automatically under D&D 5e 2024 revised rules. Never roll for players. Player reactions must become explicit reaction opportunities and must not be auto-chosen. Return concise narration only; do not expose hidden information.`;
  try{
    const res=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,campaignState:{campaign:c,initiative,tokens,characters:chars,recentStory:events}})});
    const raw=await res.text();let data:any={};try{data=JSON.parse(raw);}catch{data={narration:raw};}
    const narration=data.narration||data.response||data.result?.narration||raw;
    await supabase.from('story_events').insert({campaign_id:c.id,actor_user_id:null,event_type:'enemy_block_resolved',payload:{summary:String(narration).slice(0,4000),block:c.active_block,round:c.round_number}});
  }catch(err){console.error('Enemy block AI failed',c.id,err);}
  await advance(c);
}

Deno.serve(async req=>{
  try{
    const secret=Deno.env.get('DD_TICK_SECRET')||'';
    if(secret&&req.headers.get('x-dd-tick-secret')!==secret)return new Response('unauthorized',{status:401});
    const now=Date.now();
    const {data:campaigns,error}=await supabase.from('campaigns').select('*').eq('paused',false).not('active_block','is',null);
    if(error)throw error;
    for(const c of campaigns||[]){
      if(c.active_block?.startsWith('enemy')){await resolveEnemyBlock(c);continue;}
      if(!c.active_deadline)continue;
      const deadline=new Date(c.active_deadline).getTime(),left=deadline-now,settings={combatTurnHours:6,...(c.settings||{})},total=(settings.combatTurnHours||6)*3600000;
      const users=await usersForBlock(c.id,c.active_block);
      const marks=c.state?.notificationMarks||{};
      if(left<=0){
        await push(c.id,users,'turn_expired','Initiative Block Expired','The 6-hour player block expired. Unsubmitted turns do nothing meaningful.');
        await supabase.from('story_events').insert({campaign_id:c.id,actor_user_id:null,event_type:'block_expired',payload:{block:c.active_block,round:c.round_number,summary:'Player block expired; unsubmitted turns were forfeited.'}});
        await advance(c);continue;
      }
      if(left<=3600000&&!marks.one_hour){marks.one_hour=true;await push(c.id,users,'one_hour','One Hour Remaining','One hour remains in your current initiative block.');await supabase.from('campaigns').update({state:{...(c.state||{}),notificationMarks:marks}}).eq('id',c.id);}
      else if(left<=total/2&&!marks.halfway){marks.halfway=true;await push(c.id,users,'halfway','Halfway Reminder','Half of your initiative block has elapsed.');await supabase.from('campaigns').update({state:{...(c.state||{}),notificationMarks:marks}}).eq('id',c.id);}
    }
    await supabase.from('reaction_windows').update({resolved:true,resolution:{type:'forfeit',reason:'deadline_expired'}}).eq('resolved',false).lte('deadline',new Date().toISOString());
    return new Response(JSON.stringify({ok:true,checked:(campaigns||[]).length}),{headers:{'Content-Type':'application/json'}});
  }catch(err){return new Response(JSON.stringify({error:String((err as Error).message||err)}),{status:500,headers:{'Content-Type':'application/json'}});}
});