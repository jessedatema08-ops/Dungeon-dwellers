window.DD_VAPID_PUBLIC_KEY='';
window.DD_APP_VERSION='1.0.0';

window.addEventListener('DOMContentLoaded',()=>{
  const style=document.createElement('style');
  style.textContent=`
    .toast{position:fixed;z-index:800;left:50%;bottom:110px;transform:translate(-50%,18px);max-width:min(90vw,560px);padding:10px 14px;border:1px solid #3a414a;border-radius:12px;background:#0d1116ef;color:#e6e8ea;font-size:12px;opacity:0;pointer-events:none;transition:.2s}.toast.show{opacity:1;transform:translate(-50%,0)}.toast.ok{border-color:#35563d}.toast.warn{border-color:#6e542c}.toast.bad{border-color:#6b3434}.isOwner .ownerOnly.buttonRow{display:flex}.criticalBoom{position:fixed;inset:0;z-index:750;pointer-events:none;background:radial-gradient(circle,rgba(255,226,151,.38),rgba(214,171,88,.12) 25%,transparent 55%);animation:ddBoom .72s ease-out both}.criticalBoom:before,.criticalBoom:after{content:"";position:absolute;left:50%;top:50%;width:18vmin;height:18vmin;border:4px solid #f4cf76;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 45px #d7aa4e}.criticalBoom:after{width:44vmin;height:44vmin;border-width:2px}.fumbleWash{position:fixed;inset:0;z-index:749;background:rgba(190,40,40,.22);pointer-events:none;animation:ddFade .48s both}@keyframes ddBoom{0%{opacity:0;transform:scale(.75)}18%{opacity:1;transform:scale(1.08)}100%{opacity:0;transform:scale(1.25)}}@keyframes ddFade{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
  `;
  document.head.appendChild(style);

  const mirror=()=>{
    const source=document.getElementById('mapFrame'),target=document.getElementById('mapFrameMapPage');
    if(source&&target&&target.innerHTML!==source.innerHTML)target.innerHTML=source.innerHTML;
    const init=document.getElementById('initiativeBlocks'),init2=document.getElementById('initiativeBlocksCampaign');
    if(init&&init2&&init2.innerHTML!==init.innerHTML)init2.innerHTML=init.innerHTML;
  };
  new MutationObserver(mirror).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','src']});
  setInterval(mirror,1000);mirror();

  const attackIntent=text=>/^(?:i\s+)?(?:attack|strike|shoot|stab|slash|hit)\b|\bi\s+(?:attack|strike|shoot|stab|slash|hit)\b|\bi\s+swing\s+at\b/i.test(String(text||'').trim());
  document.addEventListener('click',e=>{
    if(e.target?.id!=='aiSend')return;
    const input=document.getElementById('aiInput');if(!input||!attackIntent(input.value))return;
    e.preventDefault();e.stopImmediatePropagation();input.value='';document.querySelector('[data-intent="attack"]')?.click();
  },true);
  document.addEventListener('keydown',e=>{
    if(e.target?.id!=='aiInput'||e.key!=='Enter'||e.shiftKey||!attackIntent(e.target.value))return;
    e.preventDefault();e.stopImmediatePropagation();e.target.value='';document.querySelector('[data-intent="attack"]')?.click();
  },true);

  let lastCritical=0,lastFumble=0;
  const impactObserver=new MutationObserver(()=>{
    if(document.querySelector('.diceTotal.critical')&&Date.now()-lastCritical>900){lastCritical=Date.now();const b=document.createElement('div');b.className='criticalBoom';document.body.appendChild(b);setTimeout(()=>b.remove(),800);}
    if(document.querySelector('.diceTotal.fumble')&&Date.now()-lastFumble>700){lastFumble=Date.now();const f=document.createElement('div');f.className='fumbleWash';document.body.appendChild(f);setTimeout(()=>f.remove(),520);}
  });
  impactObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  const notice=document.getElementById('sceneNotice');let visionTimer=null,lastSceneText='';
  if(notice)new MutationObserver(()=>{
    const text=notice.textContent||'';
    if(!text||text===lastSceneText||/considering the action/i.test(text))return;
    lastSceneText=text;clearTimeout(visionTimer);
    visionTimer=setTimeout(async()=>{
      const campaign_id=localStorage.getItem('ddPreferredCampaign');
      if(!campaign_id||!window.ddSupabase?.functions)return;
      try{await window.ddSupabase.functions.invoke('vision-refresh',{body:{campaign_id}});}catch(err){console.info('Vision refresh unavailable until the Edge Function is deployed.');}
    },1400);
  }).observe(notice,{childList:true,characterData:true,subtree:true});
});
