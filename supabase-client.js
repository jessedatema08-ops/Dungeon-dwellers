(()=>{
'use strict';
const SUPABASE_URL='https://xyvwicaoqnhjsfmjsgtk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_oidZHzC3CnuG_L_vkI7a8g_8cxMclpt';
if(!window.supabase){console.error('Supabase library failed to load');return;}
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
window.ddSupabase=client;

async function unwrap(promise){const {data,error}=await promise;if(error)throw error;return data;}
async function session(){const data=await unwrap(client.auth.getSession());return data.session;}
async function user(){return (await session())?.user||null;}

const DB={
  client,
  session,user,
  onAuth(cb){return client.auth.onAuthStateChange((_event,s)=>cb(s));},
  async signUp(email,password){return unwrap(client.auth.signUp({email,password}));},
  async signIn(email,password){return unwrap(client.auth.signInWithPassword({email,password}));},
  async signOut(){const {error}=await client.auth.signOut();if(error)throw error;},

  async myCampaigns(){
    return (await unwrap(client.from('campaign_members').select('campaign_id,role,joined_at,campaigns(*)').order('joined_at',{ascending:true})))||[];
  },
  async createCampaign(name='The Ashen Vault'){
    const u=await user();if(!u)throw new Error('Sign in first.');
    const campaign=await unwrap(client.from('campaigns').insert({owner_id:u.id,name,chapter:1,settings:{combatTurnHours:6,reactionWindowHours:1,sceneTurnHours:24,initiativeStyle:'initiative_blocks'}}).select().single());
    await unwrap(client.from('campaign_members').insert({campaign_id:campaign.id,user_id:u.id,role:'owner'}));
    await unwrap(client.from('notification_preferences').upsert({campaign_id:campaign.id,user_id:u.id},{onConflict:'campaign_id,user_id'}));
    return campaign;
  },
  async campaign(id){return unwrap(client.from('campaigns').select('*').eq('id',id).single());},
  async saveCampaign(id,patch){return unwrap(client.from('campaigns').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).select().single());},
  async members(id){return (await unwrap(client.from('campaign_members').select('campaign_id,user_id,role,joined_at').eq('campaign_id',id).order('joined_at')))||[];},
  async createInvite(campaignId,{expiresHours=168,maxUses=null}={}){
    const u=await user();if(!u)throw new Error('Sign in first.');
    const expires_at=expiresHours?new Date(Date.now()+expiresHours*3600000).toISOString():null;
    return unwrap(client.from('campaign_invites').insert({campaign_id:campaignId,created_by:u.id,expires_at,max_uses:maxUses}).select().single());
  },
  async invites(campaignId){return (await unwrap(client.from('campaign_invites').select('*').eq('campaign_id',campaignId).order('created_at',{ascending:false})))||[];},
  async revokeInvite(id){return unwrap(client.from('campaign_invites').update({revoked:true}).eq('id',id).select().single());},
  async acceptInvite(token){const data=await unwrap(client.rpc('accept_campaign_invite',{p_token:token}));return data;},

  async character(campaignId){
    const u=await user();if(!u)return null;
    return unwrap(client.from('characters').select('*').eq('campaign_id',campaignId).eq('user_id',u.id).maybeSingle());
  },
  async saveCharacter(campaignId,character){
    const u=await user();if(!u)throw new Error('Sign in first.');
    const row={...character,campaign_id:campaignId,user_id:u.id,updated_at:new Date().toISOString()};
    if(row.id)return unwrap(client.from('characters').upsert(row,{onConflict:'id'}).select().single());
    delete row.id;
    return unwrap(client.from('characters').upsert(row,{onConflict:'campaign_id,user_id'}).select().single());
  },

  async story(campaignId,limit=60){return (await unwrap(client.from('story_events').select('*').eq('campaign_id',campaignId).order('created_at',{ascending:false}).limit(limit)))||[];},
  async addStory(campaignId,event_type,payload={}){
    const u=await user();
    return unwrap(client.from('story_events').insert({campaign_id:campaignId,actor_user_id:u?.id||null,event_type,payload}).select().single());
  },
  async knowledge(campaignId){return (await unwrap(client.from('knowledge').select('*').eq('campaign_id',campaignId).order('created_at',{ascending:false})))||[];},
  async quests(campaignId){return (await unwrap(client.from('quests').select('*').eq('campaign_id',campaignId).order('updated_at',{ascending:false})))||[];},

  async tokens(campaignId){return (await unwrap(client.from('tokens').select('*').eq('campaign_id',campaignId)))||[];},
  async saveToken(token){return unwrap(client.from('tokens').upsert({...token,updated_at:new Date().toISOString()},{onConflict:'id'}).select().single());},
  async tokenVisibility(campaignId){
    const tokens=await this.tokens(campaignId);if(!tokens.length)return [];
    return (await unwrap(client.from('token_visibility').select('*').in('token_id',tokens.map(t=>t.id))))||[];
  },

  async activeMap(campaignId){return unwrap(client.from('campaign_maps').select('*').eq('campaign_id',campaignId).eq('active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle());},
  async mapView(mapId){const u=await user();if(!u)return null;return unwrap(client.from('map_views').select('*').eq('map_id',mapId).eq('user_id',u.id).maybeSingle());},
  async mapUrl(storagePath){if(!storagePath)return null;const data=await unwrap(client.storage.from('campaign-maps').createSignedUrl(storagePath,3600));return data.signedUrl;},
  async uploadMap(campaignId,file,name='Campaign Map'){
    if(!file?.type?.startsWith('image/'))throw new Error('Choose a PNG, JPG, or WebP map image.');
    const ext=(file.name.split('.').pop()||'png').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const path=`${campaignId}/${crypto.randomUUID()}.${ext}`;
    await unwrap(client.storage.from('campaign-maps').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type}));
    await unwrap(client.from('campaign_maps').update({active:false}).eq('campaign_id',campaignId).eq('active',true));
    return unwrap(client.from('campaign_maps').insert({campaign_id:campaignId,name,storage_path:path,active:true,generated_spec:{}}).select().single());
  },
  async createGeneratedMap(campaignId,spec){
    await unwrap(client.from('campaign_maps').update({active:false}).eq('campaign_id',campaignId).eq('active',true));
    return unwrap(client.from('campaign_maps').insert({campaign_id:campaignId,name:spec?.name||'Generated Dungeon',active:true,generated_spec:spec||{}}).select().single());
  },

  async initiative(campaignId){return (await unwrap(client.from('initiative_entries').select('*').eq('campaign_id',campaignId).eq('defeated',false).order('block_index').order('initiative',{ascending:false})))||[];},
  async startInitiative(campaignId,entries){
    await unwrap(client.from('initiative_entries').delete().eq('campaign_id',campaignId));
    if(entries.length)await unwrap(client.from('initiative_entries').insert(entries.map(e=>({...e,campaign_id:campaignId}))));
    await unwrap(client.rpc('assign_initiative_blocks',{p_campaign:campaignId}));
    const deadline=new Date(Date.now()+6*3600000).toISOString();
    await this.saveCampaign(campaignId,{active_block:'player_1',round_number:1,active_deadline:deadline,deadline_type:'combat_block'});
    return this.initiative(campaignId);
  },
  async submitTurn(campaignId,roundNumber,blockIndex,action){
    const u=await user();if(!u)throw new Error('Sign in first.');
    return unwrap(client.from('turn_submissions').upsert({campaign_id:campaignId,round_number:roundNumber,block_index:blockIndex,user_id:u.id,action,submitted_at:new Date().toISOString()},{onConflict:'campaign_id,round_number,block_index,user_id'}).select().single());
  },
  async myTurnSubmission(campaignId,roundNumber,blockIndex){
    const u=await user();if(!u)return null;
    return unwrap(client.from('turn_submissions').select('*').eq('campaign_id',campaignId).eq('round_number',roundNumber).eq('block_index',blockIndex).eq('user_id',u.id).maybeSingle());
  },
  async myReactions(campaignId){
    const u=await user();if(!u)return [];
    return (await unwrap(client.from('reaction_windows').select('*').eq('campaign_id',campaignId).eq('user_id',u.id).eq('resolved',false).gt('deadline',new Date().toISOString()).order('created_at',{ascending:false})))||[];
  },
  async resolveReaction(id,resolution){return unwrap(client.from('reaction_windows').update({resolved:true,resolution}).eq('id',id).select().single());},

  async notificationPrefs(campaignId){
    const u=await user();if(!u)return null;
    let row=await unwrap(client.from('notification_preferences').select('*').eq('campaign_id',campaignId).eq('user_id',u.id).maybeSingle());
    if(!row)row=await unwrap(client.from('notification_preferences').insert({campaign_id:campaignId,user_id:u.id}).select().single());
    return row;
  },
  async saveNotificationPrefs(campaignId,patch){
    const u=await user();if(!u)throw new Error('Sign in first.');
    return unwrap(client.from('notification_preferences').upsert({campaign_id:campaignId,user_id:u.id,...patch,updated_at:new Date().toISOString()},{onConflict:'campaign_id,user_id'}).select().single());
  },
  async savePushSubscription(subscription){
    const u=await user();if(!u)throw new Error('Sign in first.');
    const json=subscription.toJSON();
    return unwrap(client.from('push_subscriptions').upsert({user_id:u.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,user_agent:navigator.userAgent,last_seen_at:new Date().toISOString()},{onConflict:'endpoint'}).select().single());
  },

  async chat(campaignId,limit=80){return (await unwrap(client.from('chat_messages').select('*').eq('campaign_id',campaignId).order('created_at',{ascending:true}).limit(limit)))||[];},
  async sendChat(campaignId,body,mentions=[]){const u=await user();if(!u)throw new Error('Sign in first.');return unwrap(client.from('chat_messages').insert({campaign_id:campaignId,user_id:u.id,body,mentions}).select().single());},

  subscribe(campaignId,onChange){
    const tables=['campaigns','campaign_members','characters','tokens','campaign_maps','map_views','token_visibility','initiative_entries','turn_submissions','reaction_windows','story_events','knowledge','quests','chat_messages'];
    const channel=client.channel(`dd:${campaignId}`);
    tables.forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:table==='campaigns'?`id=eq.${campaignId}`:`campaign_id=eq.${campaignId}`},payload=>onChange(table,payload)));
    return channel.subscribe();
  },
  unsubscribe(channel){if(channel)client.removeChannel(channel);}
};
window.DungeonDB=DB;
window.dispatchEvent(new CustomEvent('dd:db-ready'));
})();