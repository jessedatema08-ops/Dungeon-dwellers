import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({ok:false,error:'POST required'},405);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,auth=req.headers.get('Authorization')||'';
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}),admin=createClient(url,service);
  const {data:uData,error:uErr}=await userClient.auth.getUser();const user=uData?.user;if(uErr||!user)return json({ok:false,error:'Authentication required'},401);
  const p=await req.json().catch(()=>({}));const campaignId=String(p.campaignId||''),message=String(p.message||'').trim().slice(0,12000);
  const visibility=p.visibility==='private'?'private':'party';const recipients=Array.isArray(p.recipientUserIds)?[...new Set(p.recipientUserIds.map(String))].slice(0,20):[];
  if(!campaignId||!message)return json({ok:false,error:'campaignId and message are required'},400);
  const {data:member}=await admin.from('campaign_members').select('role').eq('campaign_id',campaignId).eq('user_id',user.id).maybeSingle();
  const {data:campaign}=await admin.from('campaigns').select('owner_id,paused,active_block,round_number,active_deadline,state').eq('id',campaignId).maybeSingle();
  if(!campaign||(!member&&campaign.owner_id!==user.id))return json({ok:false,error:'Campaign access denied'},403);
  if(visibility==='private'&&!recipients.length)return json({ok:false,error:'Choose at least one private recipient'},400);
  if(recipients.length){const {data:valid}=await admin.from('campaign_members').select('user_id').eq('campaign_id',campaignId).in('user_id',recipients);const allowed=new Set((valid||[]).map((x:any)=>x.user_id));for(const id of recipients)if(!allowed.has(id)&&id!==campaign.owner_id)return json({ok:false,error:'A selected recipient is not in this campaign'},400);}

  const channelContext=visibility==='private'
    ?`This is a private DM conversation visible only to the speaking player and selected recipients. Do not reveal information those recipients should not know.`
    :`This is the shared party chat. Keep player-specific secrets out of the public response.`;
  const turnContext=campaign.paused
    ?'Campaign progression is currently paused.'
    :campaign.active_block
      ?`Combat is active in block ${campaign.active_block}, round ${campaign.round_number||1}.`
      :`The campaign is outside combat in scene turn ${campaign.state?.scene_turn_number||1}.`;
  const chatRules=`${channelContext} ${turnContext}\nThis chat is ALWAYS conversational and non-action-authoritative. You may answer questions at any time, including out of turn, about rules, already-known campaign facts, the player's character sheet, inventory, visible map information, previously revealed lore, or clarification of what has already happened. You may also answer ordinary out-of-character questions.\nDo NOT use chat to let a player take an in-world action or gain new in-world information. Do not resolve movement, attacks, spell use, item use, NPC conversations, searching, scouting, perception, investigation, examining an object, opening something, sneaking, manipulating the environment, or any other attempt to change or discover the game world. Do not make checks or reveal clues in response to such requests. Instead, briefly say that the action must be submitted through the proper Scene Turn or combat action flow.\nIf a message mixes a question with an attempted action, answer only the non-action question and redirect the action portion. Respond as the AI Dungeon Master in a concise chat-message style.`;
  const edge=await fetch(`${url}/functions/v1/dungeon-ai`,{method:'POST',headers:{'Authorization':auth,'apikey':anon,'Content-Type':'application/json'},body:JSON.stringify({campaignId,message:`${chatRules}\n\nCHAT MESSAGE:\n${message}`,suppressChatPersist:true})});
  const text=await edge.text();let data:any;try{data=text?JSON.parse(text):{}}catch{data={}}if(!edge.ok||data?.ok===false)return json({ok:false,error:data?.error||text||`AI HTTP ${edge.status}`},502);
  const narration=String(data?.narration||'').trim();
  if(narration){
    const dmRecipients=visibility==='private'?[...new Set([user.id,...recipients])]:[];
    const {data:row,error}=await admin.from('chat_messages').insert({campaign_id:campaignId,user_id:null,sender_kind:'dm',visibility,recipient_user_ids:dmRecipients,body:narration,mentions:[],metadata:{source:'dungeon-chat',channel:visibility==='party'?'party':'direct',event:data?.event||null,chat_only:true}}).select('id').single();
    if(error)return json({ok:false,error:error.message},500);
    if(visibility==='private'){
      for(const target of dmRecipients){
        await admin.from('notification_outbox').insert({campaign_id:campaignId,user_id:target,kind:'mentions',title:'Private message from AI DM',body:narration.slice(0,180),data:{campaignId,chatMessageId:row?.id,direct:true},deliver_after:new Date().toISOString()});
      }
    }
  }
  return json({ok:true,narration,event:data?.event||null});
});