import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

function extractJson(text:string){
  let s=String(text||'').trim();
  const f=s.match(/```(?:json)?\s*([\s\S]*?)```/i);if(f)s=f[1].trim();
  const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)throw new Error('Importer did not return valid JSON');
  return JSON.parse(s.slice(a,b+1));
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({ok:false,error:'POST required'},405);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,auth=req.headers.get('Authorization')||'';
  const aiUrl=Deno.env.get('DUNGEON_AI_WORKER_URL')||'https://dungeon-dwellers-ai.jesse-datema08.workers.dev';
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}),admin=createClient(url,service);
  const {data:ud,error:ue}=await userClient.auth.getUser();const user=ud?.user;if(ue||!user)return json({ok:false,error:'Authentication required'},401);
  const p=await req.json().catch(()=>({}));const campaignId=String(p.campaignId||''),filename=String(p.filename||'character.pdf').slice(0,180),pdfText=String(p.pdfText||'').slice(0,120000);
  if(!campaignId||pdfText.length<40)return json({ok:false,error:'campaignId and extracted PDF text are required'},400);
  const {data:member}=await admin.from('campaign_members').select('role').eq('campaign_id',campaignId).eq('user_id',user.id).maybeSingle();
  const {data:campaign}=await admin.from('campaigns').select('owner_id').eq('id',campaignId).maybeSingle();
  if(!campaign||(!member&&campaign.owner_id!==user.id))return json({ok:false,error:'Campaign access denied'},403);

  const instruction=`You are a lossless D&D Beyond character-sheet importer for Dungeon Dwellers. Parse ONLY facts explicitly present in the supplied PDF text. Never invent, infer, normalize from generic D&D knowledge, or fill missing values from memory. Preserve wording and numerical details. This importer must capture every usable detail from the sheet: identity, player name if present, class/subclass and levels, species/race/lineage, background, alignment, XP, appearance, biography/personality/ideals/bonds/flaws, ability scores and modifiers, proficiency bonus, inspiration, saves and proficiencies, skills and expertise, passive scores, armor class, initiative, speed/movement, HP/temp HP/hit dice/death saves, senses, languages, armor/weapon/tool/skill proficiencies, conditions if printed, attacks and weapons with attack bonus/damage/type/properties/range/notes, all equipment/inventory with quantity/weight/value/equipped/attunement/charges/notes, currency, features and traits including species/background/class/subclass/feats, resources/uses/recovery, spellcasting classes/ability/save DC/attack bonus/prepared or known status, spell slots by level, and every spell with every printed stat or description available. Keep any miscellaneous or unclassified sheet text in importedSections so no information is silently discarded.

Return ONLY valid JSON with this shape. Empty/missing fields must be null, [], or {} rather than invented values:
{
 "identity":{"name":null,"playerName":null,"class":null,"subclass":null,"level":null,"classes":[],"species":null,"race":null,"lineage":null,"background":null,"alignment":null,"xp":null,"rulesEdition":"D&D 5e 2024 revised"},
 "appearance":{"age":null,"height":null,"weight":null,"eyes":null,"skin":null,"hair":null,"gender":null,"size":null,"description":null},
 "biography":{"personalityTraits":[],"ideals":[],"bonds":[],"flaws":[],"backstory":null,"allies":null,"organizations":null,"treasureNotes":null,"otherNotes":null},
 "abilities":{},
 "savingThrows":{},
 "skills":{},
 "passiveScores":{},
 "defenses":{"armorClass":null,"initiativeBonus":null,"speed":null,"movement":{},"currentHp":null,"maxHp":null,"tempHp":null,"hitDice":[],"deathSaves":{},"conditions":[],"senses":{}},
 "proficiencyBonus":null,
 "inspiration":null,
 "proficiencies":{"armor":[],"weapons":[],"tools":[],"skills":[],"savingThrows":[],"languages":[],"other":[]},
 "attacks":[],
 "equipment":{"weapons":[],"armor":[],"gear":[],"consumables":[],"magicItems":[],"currency":{},"carriedWeight":null,"carryingCapacity":null},
 "features":[],
 "classFeatures":[],
 "speciesFeatures":[],
 "backgroundFeatures":[],
 "feats":[],
 "resources":[],
 "spellcasting":{"canCastSpells":false,"classes":[],"ability":null,"spellSaveDC":null,"spellAttackBonus":null,"slots":{},"spells":[]},
 "companions":[],
 "importedSections":[],
 "unclassified":[]
}

For arrays of attacks, equipment, features and spells, store objects with all printed attributes instead of reducing to names. For spells specifically retain: name, level, school, castingTime, range, target, components, material, duration, concentration, ritual, prepared, attackOrSave, damageOrEffect, description, source if present. For weapons retain name, attackBonus, damage, damageType, range, properties, mastery, proficient, equipped, notes. For features retain name, source, sourceType, level, actionType, usesCurrent, usesMax, recovery, description. Include raw snippets in importedSections when a field is hard to classify.

PDF FILE: ${filename}\n\nPDF TEXT:\n${pdfText}`;

  const aiRes=await fetch(aiUrl,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({message:instruction,campaignState:{mode:'character_import',rulesEdition:'D&D 5e 2024 revised'}})});
  const raw=await aiRes.text();let wrapped:any;try{wrapped=raw?JSON.parse(raw):{}}catch{wrapped={raw}}if(!aiRes.ok||wrapped?.ok===false)return json({ok:false,error:wrapped?.error||wrapped?.message||raw||`AI HTTP ${aiRes.status}`},502);
  const text=String(typeof wrapped==='string'?wrapped:(wrapped.narration||wrapped.response||wrapped.result?.narration||wrapped.result?.response||wrapped.raw||''));
  let profile:any;try{profile=extractJson(text)}catch(e){return json({ok:false,error:`Could not parse imported character data: ${e}`},502);}
  profile.importedPdf={filename,importedAt:new Date().toISOString(),rawText:pdfText,source:'D&D Beyond PDF'};
  profile.identity={...(profile.identity||{}),rulesEdition:'D&D 5e 2024 revised'};
  const name=String(profile.identity?.name||'Imported Character').slice(0,160),hp=Number(profile.defenses?.currentHp??profile.defenses?.maxHp??0)||0,maxHp=Number(profile.defenses?.maxHp??profile.defenses?.currentHp??0)||0,ac=Number(profile.defenses?.armorClass??0)||0;
  const existing=await admin.from('characters').select('id').eq('campaign_id',campaignId).eq('user_id',user.id).maybeSingle();
  const row:any={campaign_id:campaignId,user_id:user.id,name,display_name:name,source:'dnd-beyond-pdf',profile,hp,max_hp:maxHp,ac,import_meta:{source:'D&D Beyond PDF',filename,imported_at:new Date().toISOString(),text_chars:pdfText.length},updated_at:new Date().toISOString()};
  let saved:any;
  if(existing.data?.id){const {data,error}=await admin.from('characters').update(row).eq('id',existing.data.id).select().single();if(error)return json({ok:false,error:error.message},500);saved=data;}
  else {const {data,error}=await admin.from('characters').insert(row).select().single();if(error)return json({ok:false,error:error.message},500);saved=data;}
  return json({ok:true,character:saved,profile});
});