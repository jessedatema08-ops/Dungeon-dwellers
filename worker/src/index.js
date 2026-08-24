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
    consumes_scene_action: { type: 'boolean' },
    action_required: {
      type: 'string',
      enum: ['none','attack_roll','damage_roll','ability_check','saving_throw','reaction','target_selection','movement','item_use','choice']
    },
    roll: {
      type: ['object','null'],
      properties: {
        label: { type: 'string' },
        ability: { type: ['string','null'] },
        skill: { type: ['string','null'] },
        dc_visible: { type: 'boolean' },
        dc: { type: ['number','null'] },
        advantage: { type: 'boolean' },
        disadvantage: { type: 'boolean' },
        reason: { type: ['string','null'] }
      },
      required: ['label','ability','skill','dc_visible','dc','advantage','disadvantage','reason']
    },
    target_options: { type: 'array', items: { type: 'string' } },
    state_effects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          operation: { type: 'string', enum: ['set','add','subtract','append','remove'] },
          value: {}
        },
        required: ['path','operation','value']
      }
    },
    hidden_notes: { type: 'string' },
    rules_note: { type: 'string' }
  },
  required: ['narration','consumes_scene_action','action_required','roll','target_options','state_effects','hidden_notes','rules_note']
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
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) }
  });
}

function systemPrompt() {
  return `You are the AI Dungeon Master for Dungeon Dwellers.

Rules and authority:
- Use D&D 5e 2024 rules only.
- The human player always performs player-facing rolls: attacks, damage, checks, saves, death saves, concentration, rerolls, and reactions.
- Never fabricate a player roll result.
- Once an attack hits and damage is required, damage is committed; do not offer a cancel/back-out option before the damage roll resolves.
- NPC and enemy rolls may be resolved by the AI.
- Respect action, bonus action, reaction, movement, concentration, conditions, resources, cover, visibility, line of sight, weapon mastery, spell areas, rests, and durations.
- Friendly fire and PvP are legal when the rules permit them.
- Hide secret information, hidden DCs, traps, unrevealed enemies, secret doors, and unknown item properties unless legitimately discovered.
- Do not reveal puzzle answers. Give only information the character could know.
- Rules questions are free. In-world investigation can consume scene time/actions when appropriate.
- Combat decision windows are 6 real-world hours. Reaction windows are 1 real-world hour. A D&D combat round remains 6 seconds in-world.
- Never directly trust or mutate arbitrary client state. Propose state_effects; the app/rules engine validates them before applying.
- Be concise in routine play and cinematic only when the event deserves it.

Return only the structured response requested by the schema.`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === 'GET') {
      return json({ ok: true, service: 'Dungeon Dwellers AI DM', model: MODEL }, 200, origin);
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, origin);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: 'Origin not allowed' }, 403, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, origin);
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const campaignState = body?.campaignState && typeof body.campaignState === 'object' ? body.campaignState : {};
    const context = body?.context && typeof body.context === 'object' ? body.context : {};

    if (!message) return json({ ok: false, error: 'message is required' }, 400, origin);
    if (message.length > 8000) return json({ ok: false, error: 'message too long' }, 413, origin);

    const stateText = JSON.stringify(campaignState);
    const contextText = JSON.stringify(context);
    if (stateText.length + contextText.length > 50000) {
      return json({ ok: false, error: 'campaign payload too large' }, 413, origin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'system', content: `Campaign state: ${stateText}\nRelevant context: ${contextText}` },
          { role: 'user', content: message }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: RESPONSE_SCHEMA
        }
      });

      const dm = result?.response ?? result;
      return json({ ok: true, dm }, 200, origin);
    } catch (error) {
      console.error('Workers AI error', error);
      return json({ ok: false, error: 'AI DM request failed' }, 502, origin);
    }
  }
};
