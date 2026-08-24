(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const client=()=>window.ddSupabase||window.DungeonDB?.client;

async function currentUser(){const c=client();if(!c)return null;const {data}=await c.auth.getUser();return data?.user||null;}
async function ownedCampaigns(){const c=client(),u=await currentUser();if(!c||!u)return[];const {data,error}=await c.from('campaigns').select('id,name,chapter,owner_id,created_at').eq('owner_id',u.id).order('created_at',{ascending:true});if(error)throw error;return data||[];}
async function removeMapFiles(campaignId){const c=client();try{const {data,error}=await c.storage.from('campaign-maps').list(campaignId,{limit:1000});if(error)throw error;const paths=(data||[]).filter(x=>x?.name).map(x=>`${campaignId}/${x.name}`);if(paths.length){const {error:removeError}=await c.storage.from('campaign-maps').remove(paths);if(removeError)throw removeError;}}catch(err){console.warn('Campaign map cleanup skipped:',err);}}
async function deleteCampaign(campaign){const c=client(),u=await currentUser();if(!c||!u)throw new Error('Sign in first.');if(campaign.owner_id!==u.id)throw new Error('Only the campaign owner can delete this campaign.');await removeMapFiles(campaign.id);const {error}=await c.from('campaigns').delete().eq('id',campaign.id).eq('owner_id',u.id);if(error)throw error;if(localStorage.getItem('ddPreferredCampaign')===campaign.id)localStorage.removeItem('ddPreferredCampaign');}

function closeDeleteModal(){const root=$('#modalRoot');if(root){root.classList.add('hidden');root.innerHTML='';}}
function confirmDelete(campaign){const root=$('#modalRoot');if(!root)return;root.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="eyebrow">Campaign Owner</div><h2>Delete Campaign</h2><p class="statusLine bad">This permanently deletes <strong>${escapeHtml(campaign.name)}</strong> and its campaign data. This cannot be undone.</p><div class="formGrid"><label class="fieldLabel">Type the campaign name to confirm<input id="deleteCampaignConfirm" autocomplete="off" placeholder="${escapeHtml(campaign.name)}"></label></div><div class="buttonRow" style="margin-top:14px"><button id="cancelCampaignDelete" class="ghostBtn">Cancel</button><button id="confirmCampaignDelete" class="dangerBtn" disabled>Delete Permanently</button></div></div></div>`;
  root.classList.remove('hidden');
  const input=$('#deleteCampaignConfirm',root),confirm=$('#confirmCampaignDelete',root);
  input?.addEventListener('input',()=>{confirm.disabled=input.value.trim()!==campaign.name;});
  $('#cancelCampaignDelete',root)?.addEventListener('click',closeDeleteModal);
  confirm?.addEventListener('click',async()=>{if(input.value.trim()!==campaign.name)return;confirm.disabled=true;confirm.textContent='Deleting...';try{await deleteCampaign(campaign);location.reload();}catch(err){confirm.disabled=false;confirm.textContent='Delete Permanently';const p=root.querySelector('.statusLine.bad');if(p)p.textContent=err.message||String(err);}});
}
function escapeHtml(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}

async function deleteCurrent(){try{const id=localStorage.getItem('ddPreferredCampaign');if(!id)return;const campaigns=await ownedCampaigns(),campaign=campaigns.find(c=>c.id===id);if(!campaign)throw new Error('Only the owner can delete this campaign.');confirmDelete(campaign);}catch(err){alert(err.message||String(err));}}

async function openManageDelete(){const root=$('#modalRoot');if(!root)return;try{const campaigns=await ownedCampaigns();root.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="eyebrow">Campaign Owner</div><h2>Delete Campaigns</h2><p class="statusLine">Only campaigns you own are shown. Deletion is permanent.</p><div id="deleteCampaignList" class="list"></div><div class="buttonRow" style="margin-top:14px"><button id="closeCampaignManager" class="ghostBtn">Close</button></div></div></div>`;root.classList.remove('hidden');const list=$('#deleteCampaignList',root);if(!campaigns.length)list.innerHTML='<div class="listItem"><strong>No owned campaigns</strong><span>There is nothing to delete.</span></div>';for(const c of campaigns){const row=document.createElement('div');row.className='listItem';row.innerHTML=`<strong>${escapeHtml(c.name)}</strong><span>${c.chapter?`Chapter ${c.chapter}`:'Campaign'}</span><div class="buttonRow" style="margin-top:8px"><button class="dangerBtn" data-delete-id="${c.id}">Delete</button></div>`;list.appendChild(row);row.querySelector('[data-delete-id]')?.addEventListener('click',()=>confirmDelete(c));}$('#closeCampaignManager',root)?.addEventListener('click',closeDeleteModal);}catch(err){alert(err.message||String(err));}}

function installControls(){
  const ownerPanel=$('#ownerPanel .buttonRow');if(ownerPanel&&!$('#deleteCampaignBtn')){const b=document.createElement('button');b.id='deleteCampaignBtn';b.className='dangerBtn';b.textContent='Delete Campaign';b.addEventListener('click',deleteCurrent);ownerPanel.appendChild(b);}
  const lobby=$('#lobby .buttonRow');if(lobby&&!$('#manageDeleteCampaignsBtn')){const b=document.createElement('button');b.id='manageDeleteCampaignsBtn';b.className='dangerBtn';b.textContent='Delete Campaigns';b.addEventListener('click',openManageDelete);lobby.appendChild(b);}
}
const observer=new MutationObserver(installControls);observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installControls);else installControls();
})();
