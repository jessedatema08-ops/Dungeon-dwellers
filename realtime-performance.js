(()=>{
'use strict';
if(window.__DD_REALTIME_PERF)return;window.__DD_REALTIME_PERF=true;
const rawSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  rawSetItem.call(this,key,value);
  if(this===localStorage&&key==='ddPreferredCampaign')window.dispatchEvent(new CustomEvent('dd:campaign-changed',{detail:{campaignId:String(value||'')}}));
};
const install=()=>{
  const DB=window.DungeonDB;
  if(!DB?.client)return false;
  DB.subscribe=function(campaign_id,onChange){
    const ch=DB.client.channel(`dd:${campaign_id}:${crypto.randomUUID()}`);
    ch.on('postgres_changes',{event:'*',schema:'public',table:'campaigns',filter:`id=eq.${campaign_id}`},p=>onChange('campaigns',p));
    ['campaign_members','characters','tokens','campaign_maps','map_views','token_visibility','initiative_entries','turn_submissions','scene_submissions','reaction_windows','story_events','knowledge','quests','notification_outbox'].forEach(table=>{
      ch.on('postgres_changes',{event:'*',schema:'public',table,filter:`campaign_id=eq.${campaign_id}`},p=>onChange(table,p));
    });
    return ch.subscribe();
  };
  return true;
};
if(!install())window.addEventListener('dd:db-ready',install,{once:true});
})();