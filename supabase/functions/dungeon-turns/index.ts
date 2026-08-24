import { createClient } from 'npm:@supabase/supabase-js@2';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const SEQ=['player_1','enemy_1','player_2','enemy_2'];
const IDX:any={player_1:1,enemy_1:2,player_2:3,enemy_2:4};
const LABEL:any={player_1:'Players · First Half',enemy_1:'Enemies · First Half',player_2:'Players · Second Half',enemy_2:'Enemies · Second Half'};

Deno.serve(async req=>{
  if(req.method!=='POST')return json({ok:false,error:'POST required'},405);
  const secret=Deno.env.get('TURN_CRON_SECRET')||'';
  if(secret&&req.headers.get('x-cron-secret')!==secret)return json({ok:false,error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,aiUrl=Deno.env.get('DUNGEON_AI_WORKER_URL')||'https://dungeon-dwellers-ai.jesse-datema08.workers.dev';
  const db=createClient(url,service);const now=new Date();
  const {data:campaigns,error}=await db.from('campaigns').select('*').eq('paused',false).not('active_deadline','is',null).lte('active_deadline',now.toISOString()).limit(100);
  if(error)return json({ok:false,error:error.message},500);
  const processed:any[]=[];

  for(const c of campaigns||[]){
    const active=String(c.active_block||'');
    if(!SEQ.includes(active))continue;
    const currentIdx=SEQ.indexOf(active),currentBlockIndex=IDX[active];
    const {data:entries}=await db.from('initiative_entries').select('*').eq('campaign_id',c.id).eq('defeated',false).order('initiative',{ascending:false});
    const blockEntries=(entries||[]).filter((e:any)=>e.block_index===currentBlockIndex);

    if(active.startsWith('player')){
      for(const e of blockEntries.filter((x:any)=>x.user_id)){
        const {data:submission}=await db.from('turn_submissions').select('id').eq('campaign_id',c.id).eq('round_number',c.round_number).eq('block_index',currentBlockIndex).eq('user_id',e.user_id).maybeSingle();
        if(!submission){
          await db.from('story_events').insert({campaign_id:c.id,actor_user_id:e.user_id,event_type:'missed_turn',payload:{summary:`${e.display_name} missed the ${LABEL[active]} decision window and does nothing meaningful this block.`,round:c.round_number,block:active}});
          await db.from('notification_outbox').insert({campaign_id:c.id,user_id:e.user_id,kind:'turn_expired',title:'Turn Window Expired',body:'Your combat block expired. No meaningful action was submitted.',data:{campaignId:c.id,round:c.round_number,block:active}});
        }
      }
    } else {
      const {data:tokens}=await db.from('tokens').select('*').eq('campaign_id',c.id);
      const {data:chars}=await db.from('characters').select('*').eq('campaign_id',c.id);
      const prompt=`Resolve ${LABEL[active]} automatically for Dungeon Dwellers using D&D 5e 2024 revised rules. Enemy/NPC mechanics may be rolled automatically. Never roll player-facing dice. Respect current positions, conditions, HP, hidden information, and legal reactions. This is round ${c.round_number}. Return concise narration and identify reaction opportunities clearly.`;
      try{
        const res=await fetch(aiUrl,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({message:prompt,campaignState:{campaign:c,initiative:entries||[],tokens:tokens||[],characters:chars||[],activeBlock:active}})});
        const txt=await res.text();let d:any;try{d=txt?JSON.parse(txt):{}}catch{d={raw:txt}};
        const narration=String(typeof d==='string'?d:(d.narration||d.response||d.result?.narration||d.result?.response||d.raw||''));
        if(narration)await db.from('story_events').insert({campaign_id:c.id,actor_user_id:null,event_type:'enemy_block_resolved',payload:{summary:narration,round:c.round_number,block:active}});
      }catch(e){await db.from('story_events').insert({campaign_id:c.id,actor_user_id:null,event_type:'enemy_block_resolution_error',payload:{summary:String(e),round:c.round_number,block:active}});}
    }

    const next=SEQ[(currentIdx+1)%4];const nextRound=next==='player_1'?Number(c.round_number||1)+1:Number(c.round_number||1);
    const hours=next.startsWith('player')?Number(c.settings?.combatTurnHours||6):0.0833333;
    const deadline=new Date(Date.now()+hours*3600000);
    await db.from('campaigns').update({active_block:next,round_number:nextRound,active_deadline:deadline.toISOString(),deadline_type:next.startsWith('player')?'combat_block':'enemy_resolution',updated_at:new Date().toISOString()}).eq('id',c.id);

    if(next==='player_1'){
      const {data:members}=await db.from('campaign_members').select('user_id').eq('campaign_id',c.id);
      for(const m of members||[])await db.from('notification_outbox').insert({campaign_id:c.id,user_id:m.user_id,kind:'round_resolved',title:'Combat Round Resolved',body:`Round ${c.round_number} has resolved. Round ${nextRound} begins.`,data:{campaignId:c.id,round:nextRound}});
    }
    if(next.startsWith('player')){
      const nextEntries=(entries||[]).filter((e:any)=>e.block_index===IDX[next]&&e.user_id);
      for(const e of nextEntries){
        await db.from('notification_outbox').insert([
          {campaign_id:c.id,user_id:e.user_id,kind:'turn_open',title:'Your Initiative Block Is Open',body:`${LABEL[next]} is open for ${hours} hours.`,data:{campaignId:c.id,round:nextRound,block:next},deliver_after:new Date().toISOString()},
          {campaign_id:c.id,user_id:e.user_id,kind:'halfway',title:'Turn Window Halfway',body:'Half of your combat decision window remains.',data:{campaignId:c.id,round:nextRound,block:next},deliver_after:new Date(Date.now()+hours*1800000).toISOString()},
          {campaign_id:c.id,user_id:e.user_id,kind:'one_hour',title:'One Hour Remaining',body:'One hour remains in your combat decision window.',data:{campaignId:c.id,round:nextRound,block:next},deliver_after:new Date(Math.max(Date.now(),deadline.getTime()-3600000)).toISOString()}
        ]);
      }
    }
    processed.push({campaign:c.id,from:active,to:next,round:nextRound});
  }
  return json({ok:true,processed});
});