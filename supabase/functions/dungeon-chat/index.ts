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
  const {data:campaign}=await admin.from('campaigns').select('owner_id').eq('id',campaignId).maybeSingle();
  if(!campaign||(!member&&campaign.owner_id!==user.id))return json({ok:false,error:'Campaign access denied'},403);
  if(visibility==='private'&&!recipients.length)return json({ok:false,error:'Choose at least one private recipient'},400);
  if(recipients.length){const {data:valid}=await admin.from('campaign_members').select('user_id').eq('campaign_id',campaignId).in('user_id',recipients);const allowed=new Set((valid||[]).map((x:any)=>x.user_id));for(const id of recipients)if(!allowed.has(id)&&id!==campaign.owner_id)return json({ok:false,error:'A selected recipient is not in this campaign'},400);}

  const context=visibility==='private'?`This is a private DM conversation visible only to the speaking player and selected recipients. Do not reveal information those recipients should not know. Respond as the AI Dungeon Master in a concise chat-message style.`:`This is the shared party chat. Respond as the AI Dungeon Master in a concise chat-message style suitable for the whole party. Keep player-specific secrets out of the public response.`;
  const edge=await fetch(`${url}/functions/v1/dungeon-ai`,{method:'POST',headers:{'Authorization':auth,'apikey':anon,'Content-Type':'application/json'},body:JSON.stringify({campaignId,message:`${context}\n\nCHAT MESSAGE:\n${message}`,suppressChatPersist:true})});
  const text=await edge.text();let data:any;try{data=text?JSON.parse(text):{}}catch{data={}}if(!edge.ok||data?.ok===false)return json({ok:false,error:data?.error||text||`AI HTTP ${edge.status}`},502);
  const narration=String(data?.narration||'').trim();
  if(narration){
    const dmRecipients=visibility==='private'?[...new Set([user.id,...recipients])]:[];
    const {data:row,error}=await admin.from('chat_messages').insert({campaign_id:campaignId,user_id:null,sender_kind:'dm',visibility,recipient_user_ids:dmRecipients,body:narration,mentions:[],metadata:{source:'dungeon-chat',channel:visibility==='party'?'party':'direct',event:data?.event||null}}).select('id').single();
    if(error)return json({ok:false,error:error.message},500);
    if(visibility==='private'){
      for(const target of dmRecipients){
        await admin.from('notification_outbox').insert({campaign_id:campaignId,user_id:target,kind:'mentions',title:'Private message from AI DM',body:narration.slice(0,180),data:{campaignId,chatMessageId:row?.id,direct:true},deliver_after:new Date().toISOString()});
      }
    }
  }
  return json({ok:true,narration,event:data?.event||null});
});