# Dungeon Dwellers — Full Beta

A near-final-feel PWA beta for the asynchronous AI-DM D&D campaign interface.

## Included in this beta
- Started solo campaign: The Ashen Vault, Chapter 4
- Scene turns and Custom Turn
- Action details → target selection → confirm/use → player-triggered roll → damage/result flow
- Claymore attack flow with 2d6 + Strength damage calculation
- Class feature detail/confirmation flows for Second Wind, Action Surge, and Indomitable
- Inventory, loot identification, rests, travel, merchant, crafting, downtime
- Quest log, NPC relationships, private discoveries
- Campaign Owner pause, rewind, state correction, initiative mode preview
- Reaction-window preview and notification test
- Fog/vision battle-map presentation
- Offline PWA caching and local persistence

## Production backend still required
The static beta represents the product flows locally. Live AI DM calls, Supabase authentication/database/realtime sync, true remote Web Push, multi-user permissions, uploaded character PDFs, and server-side campaign event history require the production backend.

## GitHub Pages
A Pages deployment workflow is included in `.github/workflows/pages.yml`.