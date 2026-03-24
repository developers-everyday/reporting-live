<p align="center">
  <img src="docs/screenshot-landing.png" alt="ReportingLive Landing Page" width="300" />
</p>

<h1 align="center">ReportingLive</h1>

<p align="center">
  <strong>Your AI News Anchor. Always On.</strong>
</p>

<p align="center">
  <a href="https://reportinglive.news"><img src="https://img.shields.io/badge/live-reportinglive.news-FF2E2E" alt="Live" /></a>
  <img src="https://img.shields.io/badge/status-beta-FF2E2E" alt="Beta" />
  <img src="https://img.shields.io/badge/stage-pre--funded-333" alt="Pre-Funded" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/github/stars/developers-everyday/reporting-live?style=social" alt="Stars" />
</p>

<p align="center">
  A hands-free, voice-first news experience. Get briefed by an AI anchor that reads, explains, and digs deeper into stories — all powered by real-time web scraping.
</p>

<p align="center">
  <!-- Replace with actual GIF -->
  <img src="docs/demo.gif" alt="ReportingLive Demo" width="300" />
</p>

<p align="center">
  <a href="https://reportinglive.news">Try it Live</a>
</p>

---

## Features

| Feature | Description | Powered By |
|---------|-------------|------------|
| **Voice-First Briefing** | AI news anchor reads headlines in natural TV-anchor style. Fully hands-free. | ElevenLabs |
| **Real-Time Scraping** | Fresh news on demand across 6 categories — Tech, Business, Sports, Gaming, Politics, Science. | Firecrawl `/v1/search` |
| **Deep Dive** | Say "tell me more" and the AI scrapes the full source article to deliver an in-depth briefing. | Firecrawl `/v1/scrape` + Azure OpenAI |
| **Multi-Source Comparison** | Ask "what are other sources saying?" to get a balanced comparison from 3+ news outlets. | Firecrawl `/v1/search` + `/v1/scrape` + Azure OpenAI |
| **Custom Topics** | Add any topic in Settings for personalized news — from "AI" to "Formula 1". | Firecrawl `/v1/search` + Azure OpenAI |
| **LLM-Refined Content** | Raw scraped data is rewritten into polished, broadcast-ready headlines and summaries. | Azure OpenAI (GPT-5.1) |
| **Interactive Voice** | Interrupt the anchor anytime. Ask questions, navigate, or request deep dives — all by voice. | ElevenLabs |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Auth**: Clerk
- **Database**: Neon PostgreSQL + Prisma 7
- **Web Scraping**: Firecrawl (search + scrape)
- **Voice Agent**: ElevenLabs Conversational AI
- **LLM**: Azure OpenAI (GPT-5.1)
- **Styling**: CSS Modules (dark theme)
- **Hosting**: Vercel

## Architecture

```
User speaks → ElevenLabs Voice Agent → Client Tools
                                           ↓
                                    Next.js API Routes
                                           ↓
                           ┌───────────────┼───────────────┐
                           ↓               ↓               ↓
                     Firecrawl         Azure OpenAI      Neon DB
                   (search/scrape)    (refine/analyze)   (cache)
```

## Quick Start

### Prerequisites

- Node.js 20+
- A [Clerk](https://clerk.dev) account (auth)
- A [Neon](https://neon.tech) PostgreSQL database
- A [Firecrawl](https://firecrawl.dev) API key
- An [ElevenLabs](https://elevenlabs.io) account with a Conversational Agent
- An [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service) deployment (optional — falls back to raw data)

### 1. Clone & Install

```bash
git clone https://github.com/developers-everyday/reporting-live.git
cd reporting-live
npm install
```

### 2. Environment Variables

Create a `.env.local` file:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Neon PostgreSQL
DATABASE_URL=postgresql://...

# Firecrawl
FIRECRAWL_API_KEY=fc-...

# ElevenLabs
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=...

# Azure OpenAI (optional — LLM refinement)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### 3. Database Setup

```bash
npx prisma db push
npx prisma generate
```

### 4. ElevenLabs Agent Setup

1. Create a Conversational Agent on the [ElevenLabs dashboard](https://elevenlabs.io)
2. Set the system prompt and first message from `elevenlabs_prompt.md`
3. Import the 5 client tools from `elevenlabs-tools/*.json`:
   - `get_current_news`, `next_news`, `previous_news`, `deep_dive`, `other_sources`
4. Add `userName` as a dynamic variable

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start your briefing.

## Firecrawl Integration

This project showcases three core Firecrawl capabilities:

| Capability | Endpoint | When It's Used |
|-----------|----------|----------------|
| **News Discovery** | `/v1/search` | Every scrape cycle — searches 6 categories + custom topics for fresh news |
| **Full Article Extraction** | `/v1/scrape` | On-demand when user says "tell me more" |
| **Search + Scrape Combo** | `/v1/search` then `/v1/scrape` ×3 | On-demand when user asks "what are other sources saying?" |
| **Custom Topic Search** | `/v1/search` | On-demand when user adds personalized topics in Settings |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page / main feed
│   ├── onboarding/                 # User onboarding flow
│   ├── api/
│   │   ├── news/
│   │   │   ├── feed/               # GET  — paginated news feed
│   │   │   ├── deep-dive/          # POST — Firecrawl scrape + LLM deep dive
│   │   │   ├── multi-source/       # POST — Firecrawl search+scrape + LLM comparison
│   │   │   └── topic-search/       # POST — Firecrawl search for custom topics
│   │   ├── scrape/trigger/         # POST — manual scrape trigger
│   │   └── cron/scrape/            # GET  — scheduled scrape endpoint
├── components/
│   ├── LandingPage.tsx             # Public landing page (beta)
│   ├── MainScreen.tsx              # Main news feed + voice agent
│   ├── Onboarding.tsx              # Interest/language/location setup
│   └── SettingsModal.tsx           # User preferences + custom topics
├── lib/
│   ├── firecrawl.ts                # Firecrawl client (search, scrape, searchAndScrape)
│   ├── llm.ts                      # Azure OpenAI (refine, deep dive, multi-source)
│   ├── scraper.ts                  # News scrape pipeline
│   ├── image-gen.ts                # Article image generation (placeholder — AI generation coming soon)
│   ├── prisma.ts                   # Database client
│   └── constants.ts                # Categories & search queries
└── proxy.ts                        # Clerk auth middleware
```

## Roadmap

### Phase 1 — Hackathon (Current)
- Voice-first news briefing with AI anchor
- Real-time scraping across 6 categories
- Deep Dive — scrape full articles on demand
- Multi-Source Comparison — balanced coverage from 3+ outlets
- Custom topic personalization
- LLM-refined broadcast-ready content
- User onboarding (interests, language, location)

### Phase 2 — Coming Soon
- **AI-generated article images** — replace placeholder images with contextual, headline-aware visuals
- **Source image extraction** — pull actual article thumbnails from Firecrawl results
- **Confidence indicators** — show agreement level across multiple sources
- **Expanded language support** — localized news in Hindi, Spanish, French, and more
- **Interaction-based learning** — personalize feed based on what users listen to and ask about

### Phase 3 — Future Vision
- Global language expansion
- News agency partnerships
- Mobile app (React Native)
- Real-time breaking news alerts via voice

## Like This Project?

If you find ReportingLive useful or interesting:

- **Star this repo** to show your support and help others discover it
- **Share it** with your network
- **[Try it live](https://reportinglive.news)** and let us know what you think

## Support the Project

ReportingLive is a pre-funded startup in beta. Running real-time scraping, voice AI, and LLM services costs money. If you'd like to help keep this project alive:

<p align="center">
  <a href="https://buymeacoffee.com/developers-everyday">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-donate-yellow?logo=buymeacoffee" alt="Donate" />
  </a>
</p>

Every contribution helps cover API costs and keeps the beta free for everyone.

## Contributing

We welcome contributors! Whether it's bug fixes, new features, or documentation improvements — all contributions are appreciated.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See the [open issues](https://github.com/developers-everyday/reporting-live/issues) for ideas on where to start.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with Firecrawl, ElevenLabs, and Azure OpenAI<br/>
  <sub>Made for the Firecrawl Hackathon 2026</sub>
</p>
