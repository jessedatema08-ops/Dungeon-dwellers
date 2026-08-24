(()=>{
'use strict';
const CONDITIONS=new Set(['blinded','charmed','deafened','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious']);
function lower(v){return String(v||'').trim().toLowerCase();}
function allSpells(profile){const s=profile?.spellcasting||{};return [...new Set([...(s.cantrips||[]),...(s.knownSpells||[]),...(s.preparedSpells||[]),...(s.innateSpells||[]),...(s.rituals||[])].map(x=>typeof x==='string'?x:x?.name).filter(Boolean))];}
function features(profile){return [...(profile?.classFeatures||[]),...(profile?.subclassFeatures||[]),...(profile?.speciesFeatures||[]),...(profile?.feats||[])];}
function inventory(profile){const e=profile?.equipment||{};return [...(e.weapons||[]),...(e.armor||[]),...(e.consumables||[]),...(e.gear||[]),...(profile?.magicItems||[])];}
function findNamed(list,name){const n=lower(name);return list.find(x=>lower(typeof x==='string'?x:x?.name)===n);}
function validateIntent(text,character){
  const profile=character?.profile||character||{},t=String(text||'').trim(),l=lower(t);if(!t)return {ok:false,reason:'No action was entered.'};
  const cast=l.match(/\bcast\s+(?:the\s+)?(?:spell\s+)?([a-z][a-z' -]{1,40})/i);
  if(cast){const spellName=cast[1].replace(/\b(?:at|on|toward|towards|using|with)\b.*$/i,'').trim(),s=profile.spellcasting||{};if(!s.canCastSpells)return {ok:false,reason:'This authoritative character record has no spellcasting capability.'};if(!findNamed(allSpells(profile),spellName))return {ok:false,reason:`${spellName} is not available on this character record.`};}
  for(const f of features(profile)){const name=f?.name;if(!name||!l.includes(lower(name)))continue;if(f.usesCurrent!=null&&Number(f.usesCurrent)<=0)return {ok:false,reason:`${name} has no uses remaining.`};}
  const namedWeapon=(profile.equipment?.weapons||[]).find(w=>l.includes(lower(w.name)));if(/\b(attack|strike|slash|stab|shoot|swing|hit)\b/.test(l)&&/\bwith\b/.test(l)&&!namedWeapon){const after=t.match(/\bwith\s+(?:my\s+)?([a-z][a-z' -]{1,35})/i)?.[1]?.replace(/\b(?:at|on|against)\b.*$/i,'').trim();if(after&&!findNamed(profile.equipment?.weapons||[],after))return {ok:false,reason:`${after} is not an available weapon on this character record.`};}
  const use=t.match(/\buse\s+(?:my\s+|the\s+)?([a-z][a-z' -]{1,40})/i);if(use){const itemName=use[1].replace(/\b(?:on|at|against|to)\b.*$/i,'').trim();const known=findNamed(inventory(profile),itemName)||findNamed(features(profile),itemName);if(!known&&itemName.length>2)return {ok:true,warning:`${itemName} is not clearly listed in the authoritative character record. The AI DM must verify it before allowing the action.`};}
  return {ok:true};
}
function advantageState(reasons=[]){let adv=0,dis=0;for(const r of reasons){if(r?.type==='advantage')adv++;if(r?.type==='disadvantage')dis++;}return adv&&dis?'normal':adv?'advantage':dis?'disadvantage':'normal';}
function applyDamage(target,amount,type='untyped'){
  amount=Math.max(0,Number(amount)||0);const p=target.profile||target,def=p.defenses||{},dtype=lower(type);const immunities=(def.immunities||[]).map(lower),resistances=(def.resistances||[]).map(lower),vulnerabilities=(def.vulnerabilities||[]).map(lower);let adjusted=amount;
  if(immunities.includes(dtype))adjusted=0;else if(resistances.includes(dtype))adjusted=Math.floor(adjusted/2);else if(vulnerabilities.includes(dtype))adjusted*=2;
  let temp=Number(def.tempHp||0),toHp=adjusted;if(temp>0){const used=Math.min(temp,toHp);temp-=used;toHp-=used;}const current=Math.max(0,Number(def.currentHp??target.hp??0)-toHp);return {amount,adjusted,type,previousHp:Number(def.currentHp??target.hp??0),currentHp:current,tempHp:temp,droppedToZero:current===0};
}
function applyHealing(target,amount){const p=target.profile||target,def=p.defenses||{},max=Number(def.maxHp??target.max_hp??0),before=Number(def.currentHp??target.hp??0),healed=Math.max(0,Number(amount)||0),current=Math.min(max,before+healed);return {previousHp:before,currentHp:current,actualHealing:current-before};}
function concentrationDC(damage){return Math.max(10,Math.floor((Number(damage)||0)/2));}
function deathSave(natural,current={successes:0,failures:0}){let successes=current.successes||0,failures=current.failures||0;if(natural===20)return {successes,failures,currentHp:1,stable:false,conscious:true};if(natural===1)failures+=2;else if(natural>=10)successes++;else failures++;return {successes:Math.min(3,successes),failures:Math.min(3,failures),currentHp:0,stable:successes>=3,dead:failures>=3,conscious:false};}
function conditionLegal(name){return CONDITIONS.has(lower(name));}
function spendResource(profile,featureName,count=1){const clone=structuredClone(profile),f=features(clone).find(x=>lower(x.name)===lower(featureName));if(!f)return {ok:false,reason:'Feature not found.',profile};if(f.usesCurrent==null)return {ok:true,profile:clone};if(f.usesCurrent<count)return {ok:false,reason:'Not enough uses remaining.',profile};f.usesCurrent-=count;return {ok:true,profile:clone,remaining:f.usesCurrent};}
window.DungeonRules={validateIntent,allSpells,features,inventory,advantageState,applyDamage,applyHealing,concentrationDC,deathSave,conditionLegal,spendResource,conditions:[...CONDITIONS]};
})();