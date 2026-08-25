const MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const ALLOWED_ORIGINS = new Set([
  'https://jessedatema08-ops.github.io',
  'http://localhost:8787',
  'http://127.0.0.1:8787'
]);

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    narration: { type: 'string' },
    response_visibility: { type: 'string', enum: ['party','private'] },
    consumes_scene_action: { type: 'boolean' },
    action_required: { type: 'string', enum: ['none','attack_roll','damage_roll','ability_check','saving_throw','reaction','target_selection','movement','item_use','choice'] },
    roll: {
      type: ['object','null'],
      properties: {
        label: { type: 'string' },
        expression: { type: 'string' },
        mode: { type: 'string', enum: ['normal','advantage','disadvantage'] },
        ability: { type: ['string','null'] },
        skill: { type: ['string','null'] },
        dc_visible: { type: 'boolean' },
        dc: { type: ['number','null'] },
        reason: { type: ['string','null'] }
      },
      required: ['label','expression','mode','ability','skill','dc_visible','dc','reason']
    },
    target_options: { type: 'array', items: { type: 'string' } },
    state_effects: {
      type: 'array', items: {
        type: 'object',
        properties: { path: { type: 'string' }, operation: { type: 'string', enum: ['set','add','subtract','append','remove'] }, value: {} },
        required: ['path','operation','value']
      }
    },
    hidden_notes: { type: 'string' },
    rules_note: { type: 'string' }
  },
  required: ['narration','response_visibility','consumes_scene_action','action_required','roll','target_options','state_effects','hidden_notes','rules_note']
};

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://jessedatema08-ops.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Vary': 'Origin'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) } });
}

function systemPrompt() {
  return `You are the AI Dungeon Master for Dungeon Dwellers.

Rules and authority:
- Use D&D 5e 2024 rules only.
- The supplied campaign and character state is authoritative.
- The human player always performs player-facing rolls: attacks, damage, checks, saves, death saves, concentration, rerolls, and reactions.
- Never fabricate or assume a player roll result.
- When a player-facing roll is required, STOP before resolving it and return the exact dice expression in roll.expression, for example 1d20+5, 2d6+3, or 1d8. Set roll.mode to normal, advantage, or disadvantage. The player should only need to press Roll.
- Do not emit state_effects for an outcome that is still waiting on a player-facing roll. Wait for the verified roll, resolve the outcome, then emit the resulting state_effects.
- Once an attack hits and damage is required, damage is committed; do not offer a cancel/back-out option before the damage roll resolves.
- NPC and enemy rolls may be resolved by the AI.
- Resolve enemy and NPC mechanics privately. Never expose enemy roll totals, modifiers, hidden DC math, hidden resources, tactical intent, planned actions, internal thoughts, or enemy-only perspective.
- Do not narrate every mechanical step of an enemy turn. Tell players only what their characters can perceive: visible movement, attacks, sounds, expressions, magic, injuries, environmental changes, and consequences.
- You may address player characters directly by name or in second person when it improves immersion. Describe uncertain enemy motives as observations, not facts. Keep enemy mechanics behind the screen.
- Respect action, bonus action, reaction, movement, concentration, conditions, resources, cover, visibility, line of sight, weapon mastery, spell areas, rests, and durations.
- Friendly fire and PvP are legal when the rules permit them.
- Public actions, visible attacks, ordinary movement, visible consequences, and non-secret information use response_visibility=party.
- Use response_visibility=private only when the player explicitly asks or acts secretly, or when the response contains information only that player should know.
- Hide secret information, hidden DCs, traps, unrevealed enemies, secret doors, unknown item properties, and private NPC state unless legitimately discovered.
- Never leak private information through narration marked party, public metadata, or public state effects.
- Whenever a resolved action changes a campaign character, state_effects MUST describe the change; do not merely narrate it.
- Target exact campaign character IDs with paths like character:<id>.hp, character:<id>.profile.defenses.conditions, character:<id>.profile.defenses.tempHp, character:<id>.profile.defenses.exhaustion, character:<id>.profile.defenses.deathSaves.failures, character:<id>.profile.resources.<key>, or character:<id>.profile.spellcasting.slots.<key>.
- Use subtract for damage/resource spending, add for healing/resource gain, append/remove for conditions, and set for explicit replacement. Only target IDs supplied in partyCharacters.
- If an enemy or NPC affects a different player than the caller, target the affected player's character ID, not the caller's.
- Never directly mutate arbitrary state. The Supabase rules layer validates every state_effect before applying it.
- Do not reveal puzzle answers. Give only information the character could know.
- Rules questions are free. In-world investigation can consume scene time/actions when appropriate.
- Combat decision windows are 6 real-world hours. Reaction windows are 1 real-world hour. A D&D combat round remains 6 seconds in-world.
- Be concise in routine play and cinematic only when the event deserves it.

Return only the structured response requested by the schema.`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method === 'GET') return json({ ok: true, service: 'Dungeon Dwellers AI DM', model: MODEL }, 200, origin);
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405, origin);
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: 'Origin not allowed' }, 403, origin);

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body' }, 400, origin); }
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const campaignState = body?.campaignState && typeof body.campaignState === 'object' ? body.campaignState : {};
    const context = body?.context && typeof body.context === 'object' ? body.context : {};
    if (!message) return json({ ok: false, error: 'message is required' }, 400, origin);
    if (message.length > 12000) return json({ ok: false, error: 'message too long' }, 413, origin);

    const stateText = JSON.stringify(campaignState);
    const contextText = JSON.stringify(context);
    if (stateText.length + contextText.length > 50000) return json({ ok: false, error: 'campaign payload too large' }, 413, origin);

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'system', content: `Campaign state: ${stateText}\nRelevant context: ${contextText}` },
          { role: 'user', content: message }
        ],
        response_format: { type: 'json_schema', schema: RESPONSE_SCHEMA }
      });
      return json({ ok: true, dm: result?.response ?? result }, 200, origin);
    } catch (error) {
      console.error('Workers AI error', error);
      return json({ ok: false, error: 'AI DM request failed', detail: String(error?.message || error) }, 502, origin);
    }
  }
};