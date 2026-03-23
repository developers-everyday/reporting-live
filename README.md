# ReportingLive - Premium AI Reporter UI

ReportingLive is a premium, AI-powered conversational news application. This repository contains the frontend User Interface built for the hackathon, demonstrating the exact user flow and animations proposed in the project documentation.

## Features Included
- **Onboarding Flow**: Beautifully animated multi-step selection for Interests, Language, and Location.
- **Main Feed Screen**: A centralized hub showcasing breaking news, a pulsing "LIVE REPORTING" indicator, and a custom interactive media card player.
- **Verified Sources**: Highlights verified source validations with interactive chips (e.g. BBC News, Reuters).
- **Interactive Audio States**: Simulated, stateful transitions modeling `Playing`, `Paused`, `Listening`, and `Answering` using dynamic CSS animations such as Siri-like audio wave visualizers and mic pulse indicators.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Vanilla CSS (CSS Modules)
- **Node Environment**: Node.js `v20.9` or higher is recommended.

## Getting Started

### Prerequisites

Ensure you have Node.js version 20.9.0 or later installed on your machine.
If you are using `nvm` (Node Version Manager), you can install and use it via:

```bash
nvm install 20
nvm use 20
```

### Installation

1. Navigate to the application root directory:
```bash
cd reporting-live-app
```

2. Install the necessary dependencies using `npm` (or `yarn` / `pnpm`):
```bash
npm install
```

### Running the Application

To start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result. The application is designed with a set max-width container, delivering a premium, mobile-widgetized interface suited for the AI reporter.

## Project Structure

- `src/app/page.tsx` - The main router handling state transitions between Onboarding and the Main Application.
- `src/components/Onboarding.tsx` - The primary entry flow component.
- `src/components/MainScreen.tsx` - The central dashboard handling play states and visualizers.
- `src/app/globals.css` - Contains the premium Dark Theme design system tokens and global CSS animations.
