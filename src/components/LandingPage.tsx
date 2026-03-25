"use client";

import { Waitlist } from "@clerk/nextjs";
import styles from "./LandingPage.module.css";

export default function LandingPage() {
  return (
    <div className={`screen ${styles.container}`}>
      {/* Beta Badge */}
      <div className={styles.topBadges}>
        <span className={styles.betaBadge}>BETA</span>
        <span className={styles.prefundBadge}>Pre-Funded Startup</span>
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.logoMark}>
          <div className={styles.liveDot} />
          <span className={styles.logoText}>ReportingLive</span>
        </div>

        <h1 className={styles.headline}>
          Your AI News Anchor.<br />
          <span className={styles.headlineAccent}>Always On.</span>
        </h1>

        <p className={styles.subheadline}>
          A hands-free, voice-first news experience. Get briefed by an AI anchor that reads, explains, and digs deeper into stories — all powered by real-time web scraping.
        </p>
      </div>

      {/* Feature Pills */}
      <div className={styles.features}>
        <div className={styles.featurePill}>
          <span className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
          </span>
          Voice-First Briefing
        </div>
        <div className={styles.featurePill}>
          <span className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>
          </span>
          Real-Time Scraping
        </div>
        <div className={styles.featurePill}>
          <span className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </span>
          Multi-Source Verified
        </div>
        <div className={styles.featurePill}>
          <span className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          Deep Dive on Demand
        </div>
      </div>

      {/* Waitlist */}
      <div className={styles.ctaSection}>
        <Waitlist
          appearance={{
            elements: {
              rootBox: { width: "100%", maxWidth: "360px" },
              card: {
                background: "var(--card-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "16px",
                boxShadow: "none",
              },
            },
          }}
        />
        <p className={styles.ctaNote}>Free during beta. No credit card needed.</p>
      </div>

      {/* Powered By */}
      <div className={styles.poweredBy}>
        <span className={styles.poweredLabel}>POWERED BY</span>
        <div className={styles.techLogos}>
          <span className={styles.techChip}>Firecrawl</span>
          <span className={styles.techChip}>ElevenLabs</span>
          <span className={styles.techChip}>Azure OpenAI</span>
        </div>
      </div>
    </div>
  );
}
