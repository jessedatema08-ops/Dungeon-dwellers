(()=>{
'use strict';
const SUPABASE_URL='https://xyvwicaoqnhjsfmjsgtk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_oidZHzC3CnuG_L_vkI7a8g_8cxMclpt';
if(!window.supabase){console.error('Supabase library failed to load');return;}
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.ddSupabase=client;

const DB={
  async session(){const {data,error}=await client.auth.getSession();if(error)throw error;return data.session;},
  async signUp(email,password){const {data,error}=await client.auth.signUp({email,password});if(error)throw error;return data;},
  async signIn(email,password){const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return data;},
  async signOut(){const {error}=await client.auth.signOut();if(error)throw error;},
  async myCampaigns(){const {data,error}=await client.from('campaign_members').select('campaign_id,role,campaigns(*)').order('joined_at',{ascending:true});if(error)throw error;return data||[];},
  async createCampaign(name='The Ashen Vault'){
    const session=await this.session();if(!session)throw new Error('Sign in first');
    const {data:campaign,error}=await client.from('campaigns').insert({owner_id:session.user.id,name}).select().single();if(error)throw error;
    const {error:memberError}=await client.from('campaign_members').insert({campaign_id:campaign.id,user_id:session.user.id,role:'owner'});if(memberError)throw memberError;
    return campaign;
  },
  async loadCampaign(campaignId){
    const {data,error}=await client.from('campaigns').select('*').eq('id',campaignId).single();if(error)throw error;return data;
  },
  async saveCampaignState(campaignId,patch){
    const {data,error}=await client.from('campaigns').update({...patch,updated_at:new Date().toISOString()}).eq('id',campaignId).select().single();if(error)throw error;return data;
  },
  async loadCharacter(campaignId){
    const session=await this.session();if(!session)return null;
    const {data,error}=await client.from('characters').select('*').eq('campaign_id',campaignId).eq('user_id',session.user.id).maybeSingle();if(error)throw error;return data;
  },
  async saveCharacter(character){
    const {data,error}=await client.from('characters').upsert(character,{onConflict:'id'}).select().single();if(error)throw error;return data;
  },
  async addStoryEvent(campaignId,eventType,payload={}){
    const session=await this.session();
    const {data,error}=await client.from('story_events').insert({campaign_id:campaignId,actor_user_id:session?.user?.id||null,event_type:eventType,payload}).select().single();if(error)throw error;return data;
  },
  async loadTokens(campaignId){const {data,error}=await client.from('tokens').select('*').eq('campaign_id',campaignId);if(error)throw error;return data||[];},
  async saveToken(token){const {data,error}=await client.from('tokens').upsert(token,{onConflict:'id'}).select().single();if(error)throw error;return data;},
  subscribeCampaign(campaignId,onChange){return client.channel(`campaign:${campaignId}`).on('postgres_changes',{event:'*',schema:'public',table:'campaigns',filter:`id=eq.${campaignId}`},onChange).on('postgres_changes',{event:'*',schema:'public',table:'tokens',filter:`campaign_id=eq.${campaignId}`},onChange).subscribe();}
};
window.DungeonDB=DB;

(async()=>{
  try{
    const {error}=await client.from('campaigns').select('id').limit(1);
    window.dispatchEvent(new CustomEvent('dd:supabase-status',{detail:{connected:!error,error:error?.message||null}}));
    if(error)console.info('Supabase connected, schema may still need setup:',error.message);
    else console.info('Dungeon Dwellers Supabase connection ready');
  }catch(err){window.dispatchEvent(new CustomEvent('dd:supabase-status',{detail:{connected:false,error:String(err)}}));}
})();
})();