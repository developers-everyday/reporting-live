# ReportingLive - Cloudflare Agents & ElevenLabs Stage 2 Integration Plan

The user wants to integrate the advanced functionalities demonstrated in the Cloudflare Agents `elevenlabs-starter` repository into the `ReportingLive` application for Stage 2 of the hackathon.

Based on review, we are scoping this down to be more focused and achievable for a hackathon, prioritizing the highest-impact visual and audio features.

## Proposed Strategy & Architecture

- **Frontend (`reporting-live-app`):** Next.js App Router. Uses `@cloudflare/agents` client SDK to connect to the backend. Will pass necessary News Data (from Prisma backend) to the agents directly so the Worker doesn't need DB access.
- **Backend (`reporting-live-agents`):** Cloudflare Worker project using `wrangler`, `@cloudflare/agents` server SDK. Authentication via a shared API key (`X-API-Key` header) — simple and sufficient for hackathon scope.

### Data Flow
```
Next.js Frontend
  ├── Fetches news articles from Prisma/Neon (existing)
  ├── Passes article text + metadata to Cloudflare Agent via WebSocket/HTTP
  └── Receives generated audio (TTS, SFX) back from Agent

Cloudflare Worker Backend
  ├── Receives article context from frontend (no direct DB access)
  ├── Uses LLM (Workers AI or proxied Azure OpenAI) for scene/persona expansion
  ├── Calls ElevenLabs APIs (Sound FX, TTS, Voice Design)
  └── Returns audio data + metadata to frontend
```

### Prioritized Features

1. **Feature 1: Immersive News Soundscapes (Soundscape Builder) - PRIORITY 1**
   - **What it does:** When presenting an in-depth news article, generate ambient background sounds that match the context of the story alongside the narration.
   - **Tech Stack:** Cloudflare stateful `Agent`, Workers AI for scene expansion, ElevenLabs Text-to-Sound-Effects, ElevenLabs TTS.
   - **Flow:** Frontend sends article text → Agent uses LLM to extract scene descriptions (e.g., "busy city intersection at night") → ElevenLabs Sound FX generates ambient audio → ElevenLabs TTS generates narration → Both returned to frontend for layered playback.

2. **Feature 2: Custom News Anchor (Character Creator) - PRIORITY 2**
   - **What it does:** Allows users to design their own personalized news anchor voice and personality.
   - **Tech Stack:** Cloudflare `Agent`, Workers AI for persona generation, ElevenLabs Voice Design (preview) & Voice Creation, ElevenLabs TTS.
   - **Flow:** User selects personality traits + voice characteristics → Agent generates persona prompt via LLM → ElevenLabs Voice Design creates preview voices → User picks one → Voice is created and stored → Future TTS uses this custom voice.

3. **Stretch Goals**
   - **Feature 3: Custom News Intro Music:** Generate 15-second intro jingles via ElevenLabs Music Composition API.
   - **Feature 4: Live Interactive News Debate:** Extend existing `@elevenlabs/react` voice interface, orchestrated by the Cloudflare backend.

## Proposed Changes

### 1. Cloudflare Backend (`reporting-live-agents`)
Scaffold a new Cloudflare worker directory using `npm create cloudflare`.

#### [NEW] `reporting-live-agents/worker.ts`
Main entry point handling CORS, API key auth validation, and exporting the Agents.

#### [NEW] `reporting-live-agents/src/agents/SoundscapeAgent.ts`
Stateful agent handling ambient sound generation. Receives article text from the frontend, uses LLM to expand scene descriptions, calls ElevenLabs Sound FX + TTS APIs.

#### [NEW] `reporting-live-agents/src/agents/AnchorAgent.ts`
Stateful agent handling Custom News Anchor creation. Manages voice design previews, voice creation, and persona state.

#### [NEW] `reporting-live-agents/wrangler.jsonc`
Configuration file with bindings:
- `ai` binding for Workers AI
- `ELEVENLABS_API_KEY` secret (via `wrangler secret put`)
- SQLite for agent state persistence (Durable Objects)

### 2. Next.js Frontend (`reporting-live-app`)

#### [MODIFY] `package.json`
Add `@cloudflare/agents` client dependency.

#### [NEW] `.env.local` addition
Add `NEXT_PUBLIC_AGENTS_URL` pointing to the deployed Worker URL (local: `http://localhost:8787`, prod: Cloudflare Workers URL).
Add `NEXT_PUBLIC_AGENTS_API_KEY` for the shared auth key.

#### [NEW] `src/app/immersive/page.tsx`
New page for immersive news playback. Fetches article from existing Prisma data, connects to SoundscapeAgent, renders layered audio player with narration + ambient sounds.

#### [NEW] `src/app/anchor-studio/page.tsx`
New page for voice/persona creation. Connects to AnchorAgent, provides UI for personality selection, voice preview, and voice creation.

#### [MODIFY] Navigation / MainScreen
Add links to the new Immersive and Anchor Studio pages from the existing UI.

## Deployment

- **Local dev:** `wrangler dev` for the Worker (port 8787), `next dev` for the frontend. Both run in parallel.
- **Production:** Deploy Worker via `wrangler deploy`. Set secrets with `wrangler secret put ELEVENLABS_API_KEY`. Update `NEXT_PUBLIC_AGENTS_URL` in Vercel/hosting env vars to the deployed Worker URL.
- **CORS:** Worker must allow the frontend origin. Configure in `worker.ts`.

## Execution Order
1. Scaffold `reporting-live-agents` with wrangler, get a hello-world Worker deployed locally. **[DONE]**
2. Build Feature 1 (Soundscapes) — high demo value. **[DONE]**
3. Build Feature 2 (Anchor Studio). **[DONE]**
4. Wire up the frontend components with the `agents/react` client SDK. **[DONE]**
5. Tackle stretch goals if time permits.
