"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgent } from 'agents/react';
import styles from './MainScreen.module.css';
import SettingsModal from './SettingsModal';
import { useConversation } from '@elevenlabs/react';

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  imageUrl: string | null;
  sourceUrls: string[];
  sourceNames: string[];
  categories: string[];
  region: string | null;
}

const VALID_IMAGE_TAGS = new Set(["war","politics","sports","cricket","football","finance","tech","science","health","gaming","climate","world","entertainment","business"]);

function getCategoryFallbackImage(categories: string[]): string {
  const tag = (categories[0] || "").toLowerCase();
  return VALID_IMAGE_TAGS.has(tag) ? `/news-images/${tag}.jpg` : `/news-images/default.jpg`;
}

export default function MainScreen({ userName }: { userName: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [micMuted, setMicMuted] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDiving, setIsDiving] = useState(false);
  const [isCheckingSources, setIsCheckingSources] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [immersiveMode, setImmersiveMode] = useState(false);

  const currentIndexRef = useRef(currentIndex);
  const newsListRef = useRef(newsList);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const customTopicsRef = useRef(customTopics);
  const userInterestsRef = useRef(userInterests);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { newsListRef.current = newsList; }, [newsList]);
  useEffect(() => { customTopicsRef.current = customTopics; }, [customTopics]);
  useEffect(() => { userInterestsRef.current = userInterests; }, [userInterests]);

  // Load immersive mode preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('reportinglive_immersive_mode');
      if (saved === 'true') setImmersiveMode(true);
    } catch {}
  }, []);

  // Connect to SoundscapeAgent for ambient audio during immersive briefing
  const soundscapeAgent = useAgent({
    agent: "soundscape-agent",
    name: "immersive-briefing",
    host: process.env.NEXT_PUBLIC_AGENTS_URL || "http://localhost:8787",
    query: { apiKey: process.env.NEXT_PUBLIC_AGENTS_API_KEY || "" },
  });

  // Generate and play ambient audio for the current article
  const playAmbientForArticle = useCallback(async (headline: string, summary: string) => {
    try {
      // Fade out and stop any existing ambient audio
      if (ambientAudioRef.current) {
        const old = ambientAudioRef.current;
        ambientAudioRef.current = null;
        const fadeOut = setInterval(() => {
          if (old.volume > 0.02) {
            old.volume = Math.max(0, old.volume - 0.03);
          } else {
            clearInterval(fadeOut);
            old.pause();
          }
        }, 60);
      }

      console.log("[Immersive] Generating ambient audio for:", headline);
      const result = await soundscapeAgent.call("generateAmbientAudio", [headline, summary]) as {
        ambientAudioBase64: string;
        sceneDescription: string;
        durationSeconds: number;
        loop: boolean;
      };

      const audio = new Audio(`data:audio/mpeg;base64,${result.ambientAudioBase64}`);
      audio.loop = true;
      audio.volume = 0;
      ambientAudioRef.current = audio;

      // Fade in
      await audio.play();
      const fadeIn = setInterval(() => {
        if (!ambientAudioRef.current || ambientAudioRef.current !== audio) {
          clearInterval(fadeIn);
          return;
        }
        if (audio.volume < 0.2) {
          audio.volume = Math.min(0.2, audio.volume + 0.02);
        } else {
          clearInterval(fadeIn);
        }
      }, 100);

      console.log("[Immersive] Ambient audio playing, scene:", result.sceneDescription);
    } catch (err) {
      // Non-fatal: briefing continues without ambient audio
      console.warn("[Immersive] Ambient audio failed (non-fatal):", err);
    }
  }, [soundscapeAgent]);

  // Stop ambient audio with fade-out
  const stopAmbientAudio = useCallback(() => {
    const audio = ambientAudioRef.current;
    if (!audio) return;
    const fadeOut = setInterval(() => {
      if (audio.volume > 0.02) {
        audio.volume = Math.max(0, audio.volume - 0.02);
      } else {
        clearInterval(fadeOut);
        audio.pause();
        ambientAudioRef.current = null;
      }
    }, 80);
  }, []);

  // Trigger ambient audio when article changes during an immersive briefing
  useEffect(() => {
    if (!isStarted || !immersiveMode) return;
    const article = newsList[currentIndex];
    if (article) {
      playAmbientForArticle(article.headline, article.summary);
    }
  }, [currentIndex, isStarted, immersiveMode, newsList, playAmbientForArticle]);

  // Cleanup ambient audio on unmount
  useEffect(() => {
    return () => {
      ambientAudioRef.current?.pause();
    };
  }, []);

  // Fetch user's custom topics
  const fetchCustomTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/user/preferences');
      const data = await res.json();
      if (data.customTopics) {
        setCustomTopics(data.customTopics);
      }
      if (data.interests) {
        setUserInterests(data.interests);
      }
    } catch (error) {
      console.error('Failed to fetch custom topics:', error);
    }
  }, []);

  // Search for custom topic articles
  const refreshCustomTopics = useCallback(async (topics: string[]) => {
    if (topics.length === 0) return;
    await Promise.allSettled(
      topics.map((topic) =>
        fetch('/api/news/topic-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: topic }),
        })
      )
    );
  }, []);

  // Fetch news from API
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news/feed');
      const data = await res.json();
      if (data.articles && data.articles.length > 0) {
        setNewsList(data.articles);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomTopics();
    fetchNews();
  }, [fetchCustomTopics, fetchNews]);

  const refreshScrape = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      // Step 1: Scrape user's selected standard categories
      const interests = userInterestsRef.current;
      const scrapeRes = await fetch('/api/scrape/trigger?force=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interests.length > 0 ? { categories: interests } : {}),
      }).then(r => r.json()).catch(() => null);
      console.log('[Scrape]', scrapeRes);
      // Step 2: Then fetch custom topic articles (after scrape, to avoid race conditions)
      await refreshCustomTopics(customTopicsRef.current);
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      await fetchNews();
    } catch (error) {
      console.error('Scrape failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, fetchNews, refreshCustomTopics]);

  const triggerDeepDive = useCallback(async () => {
    const news = newsListRef.current[currentIndexRef.current];
    if (!news || isDiving) return;
    setIsDiving(true);
    setActionResult(null);
    try {
      const res = await fetch('/api/news/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: news.id }),
      });
      const data = await res.json();
      if (data.success && data.briefing) {
        setActionResult(data.briefing);
      }
    } catch {
      setActionResult("Couldn't fetch details right now.");
    } finally {
      setIsDiving(false);
    }
  }, [isDiving]);

  const triggerOtherSources = useCallback(async () => {
    const news = newsListRef.current[currentIndexRef.current];
    if (!news || isCheckingSources) return;
    setIsCheckingSources(true);
    setActionResult(null);
    try {
      const res = await fetch('/api/news/multi-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: news.id }),
      });
      const data = await res.json();
      if (data.success && data.comparison) {
        setActionResult(data.comparison);
      }
    } catch {
      setActionResult("Couldn't check other sources right now.");
    } finally {
      setIsCheckingSources(false);
    }
  }, [isCheckingSources]);

  const currentNews = newsList[currentIndex];

  // Navigation helpers (also used by manual prev/next buttons)
  const goNext = useCallback(() => {
    const len = newsListRef.current.length;
    if (len === 0) return;
    const next = (currentIndexRef.current + 1) % len;
    currentIndexRef.current = next;
    setCurrentIndex(next);
    setActionResult(null);
    const article = newsListRef.current[next];
    if (article) {
      fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsArticleId: article.id, type: 'view' }),
      }).catch(console.error);
    }
  }, []);

  const goPrev = useCallback(() => {
    const len = newsListRef.current.length;
    if (len === 0) return;
    const prev = (currentIndexRef.current - 1 + len) % len;
    currentIndexRef.current = prev;
    setCurrentIndex(prev);
    setActionResult(null);
    const article = newsListRef.current[prev];
    if (article) {
      fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsArticleId: article.id, type: 'view' }),
      }).catch(console.error);
    }
  }, []);

  const conversation = useConversation({
    micMuted,
    onConnect: () => {
      console.log("[ElevenLabs] Connected");
    },
    onDisconnect: (details) => {
      console.log("[ElevenLabs] Disconnected:", details);
      setIsStarted(false);
    },
    onMessage: (message) => {
      console.log("[ElevenLabs] Message:", message);
    },
    onError: (e, context) => {
      console.error("[ElevenLabs] Error:", e, context);
      setIsStarted(false);
    },
    onStatusChange: (status) => {
      console.log("[ElevenLabs] Status:", status);
    },
    onUnhandledClientToolCall: (toolCall) => {
      console.warn("[ElevenLabs] Unhandled tool call:", toolCall);
    },
    clientTools: {
      get_current_news: () => {
        const news = newsListRef.current[currentIndexRef.current];
        const result = news
          ? `Headline: ${news.headline}. Summary: ${news.summary}`
          : "No news article is currently displayed.";
        console.log("[ElevenLabs] get_current_news called, returning:", result);
        return result;
      },
      next_news: () => {
        console.log("[ElevenLabs] next_news called");
        const len = newsListRef.current.length;
        if (len === 0) return "No news articles available.";
        const next = (currentIndexRef.current + 1) % len;
        currentIndexRef.current = next;
        setCurrentIndex(next);
        const article = newsListRef.current[next];
        if (article) {
          fetch('/api/interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newsArticleId: article.id, type: 'view' }),
          }).catch(console.error);
          return `Moved to next article. Headline: ${article.headline}. Summary: ${article.summary}`;
        }
        return "Moved to the next news article.";
      },
      previous_news: () => {
        console.log("[ElevenLabs] previous_news called");
        const len = newsListRef.current.length;
        if (len === 0) return "No news articles available.";
        const prev = (currentIndexRef.current - 1 + len) % len;
        currentIndexRef.current = prev;
        setCurrentIndex(prev);
        const article = newsListRef.current[prev];
        if (article) {
          fetch('/api/interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newsArticleId: article.id, type: 'view' }),
          }).catch(console.error);
          return `Moved to previous article. Headline: ${article.headline}. Summary: ${article.summary}`;
        }
        return "Moved to the previous news article.";
      },
      deep_dive: async () => {
        console.log("[ElevenLabs] deep_dive called");
        const news = newsListRef.current[currentIndexRef.current];
        if (!news) return "No article is currently displayed.";
        setIsDiving(true);
        setActionResult(null);
        try {
          const res = await fetch('/api/news/deep-dive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articleId: news.id }),
          });
          const data = await res.json();
          setIsDiving(false);
          if (data.success && data.briefing) {
            setActionResult(data.briefing);
            return `Here's a deeper look at this story: ${data.briefing}`;
          }
          return data.briefing || "I wasn't able to get more details on this story right now.";
        } catch {
          setIsDiving(false);
          return "I had trouble fetching the details. Let's move on.";
        }
      },
      other_sources: async () => {
        console.log("[ElevenLabs] other_sources called");
        const news = newsListRef.current[currentIndexRef.current];
        if (!news) return "No article is currently displayed.";
        setIsCheckingSources(true);
        setActionResult(null);
        try {
          const res = await fetch('/api/news/multi-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articleId: news.id }),
          });
          const data = await res.json();
          setIsCheckingSources(false);
          if (data.success && data.comparison) {
            setActionResult(data.comparison);
            return `Here's what other sources are saying: ${data.comparison}`;
          }
          return data.comparison || "I couldn't find additional source coverage for this story right now.";
        } catch {
          setIsCheckingSources(false);
          return "I had trouble checking other sources. Let's continue.";
        }
      }
    }
  });

  const startBriefing = async () => {
    console.log("[Briefing] Button clicked, conversation status:", conversation.status);
    try {
      console.log("[Briefing] Requesting mic access...");
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[Briefing] Mic access granted");

      // Check for custom anchor voice from Anchor Studio
      let customVoiceId: string | undefined;
      try {
        const savedAnchor = localStorage.getItem("reportinglive_custom_anchor");
        if (savedAnchor) {
          const parsed = JSON.parse(savedAnchor);
          customVoiceId = parsed.voiceId;
          console.log("[Briefing] Custom anchor voice found:", customVoiceId);
        } else {
          console.log("[Briefing] No custom anchor, using default voice");
        }
      } catch {
        console.warn("[Briefing] Failed to parse saved anchor, using default");
      }

      // @ts-ignore
      await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '',
        dynamicVariables: {
          userName,
        },
        ...(customVoiceId ? {
          overrides: {
            tts: { voiceId: customVoiceId },
          },
        } : {}),
      });
      console.log("[Briefing] Session started successfully");
      setIsStarted(true);
    } catch (e) {
      console.error("[Briefing] Failed:", e);
      alert("Failed to start briefing: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const stopBriefing = async () => {
    await conversation.endSession();
    stopAmbientAudio();
    setIsStarted(false);
    setMicMuted(true);
  };

  // Refetch news when settings close (preferences may have changed)
  const handleSettingsClose = async () => {
    setIsSettingsOpen(false);
    await fetchCustomTopics();
    await fetchNews();
  };

  // Auto-trigger scrape when feed is empty (e.g., first load or after DB was cleaned)
  useEffect(() => {
    if (!isLoading && newsList.length === 0 && !isRefreshing) {
      refreshScrape();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className={`screen ${styles.container}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading news...</div>
      </div>
    );
  }

  return (
    <div className={`screen ${styles.container} animate-slide-up`}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.location}>
          <span className={styles.dot}></span>
          {currentNews?.categories?.[0] || 'News'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`${styles.iconBtn} ${isRefreshing ? styles.spinning : ''}`} onClick={refreshScrape} disabled={isRefreshing}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={() => setIsSettingsOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
               <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
               <path d="M19.4 15A1.65 1.65 0 0 0 21 13.35V10.65A1.65 1.65 0 0 0 19.4 9H18.6A3.4 3.4 0 0 1 15 5.4V4.6A1.65 1.65 0 0 0 13.35 3H10.65A1.65 1.65 0 0 0 9 4.6V5.4A3.4 3.4 0 0 1 5.4 9H4.6A1.65 1.65 0 0 0 3 10.65V13.35A1.65 1.65 0 0 0 4.6 15H5.4A3.4 3.4 0 0 1 9 18.6V19.4A1.65 1.65 0 0 0 10.65 21H13.35A1.65 1.65 0 0 0 15 19.4V18.6A3.4 3.4 0 0 1 18.6 15H19.4Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.liveIndicator}>
         <div className={styles.livePulse}></div>
         {isRefreshing ? 'FETCHING FRESH NEWS...' : 'LIVE REPORTING'}
         <button
           className={`${styles.immersiveToggle} ${immersiveMode ? styles.immersiveActive : ''}`}
           onClick={() => {
             const next = !immersiveMode;
             setImmersiveMode(next);
             localStorage.setItem('reportinglive_immersive_mode', String(next));
             if (!next) stopAmbientAudio();
           }}
           title={immersiveMode ? 'Immersive mode ON' : 'Immersive mode OFF'}
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
           </svg>
         </button>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {newsList.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--text-muted)', textAlign: 'center' }}>
            <div>
              <p>{isRefreshing ? 'Fetching your news...' : 'No news articles yet.'}</p>
              {!isRefreshing && <p style={{ fontSize: '14px', marginTop: '8px' }}>Hit refresh or update your topics in Settings.</p>}
            </div>
          </div>
        ) : currentNews && (
          <>
            <div key={currentNews.id} className={`${styles.newsCard} animate-slide-up`}>
              {currentNews.imageUrl && (
                <div className={styles.newsImageContainer}>
                  <img
                    src={currentNews.imageUrl.replace("http://localhost:8787", "")}
                    alt={currentNews.headline}
                    className={styles.newsImage}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      const fallback = getCategoryFallbackImage(currentNews.categories);
                      if (!img.src.endsWith(fallback)) {
                        img.src = fallback;
                      } else {
                        img.parentElement!.style.display = 'none';
                      }
                    }}
                  />
                </div>
              )}
              <h2 className={styles.newsHeadline}>{currentNews.headline}</h2>
              <p className={styles.newsSummary}>{currentNews.summary}</p>

              {/* Verified Sources */}
              <div className={styles.sourcesWrapper}>
                <div className={styles.sourcesTitle}>VERIFIED SOURCES</div>
                <div className={styles.sourcesList}>
                  {currentNews.sourceNames.map((src) => (
                    <div key={src} className={styles.sourceChip}>
                      <span className={styles.checkIcon}>✓</span> {src}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>


      {/* Action Buttons */}
      {currentNews && (
        <div className={styles.actionBar}>
          <button
            className={`${styles.actionBtn} ${isDiving ? styles.actionLoading : ''}`}
            onClick={triggerDeepDive}
            disabled={isDiving || isCheckingSources}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            {isDiving ? 'Diving...' : 'Deep Dive'}
          </button>
          <button
            className={`${styles.actionBtn} ${isCheckingSources ? styles.actionLoading : ''}`}
            onClick={triggerOtherSources}
            disabled={isDiving || isCheckingSources}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            {isCheckingSources ? 'Checking...' : 'Other Sources'}
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => {
              if (currentNews) {
                window.location.href = `/immersive?articleId=${currentNews.id}`;
              }
            }}
            disabled={!currentNews}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Soundscape
          </button>
        </div>
      )}

      {/* Action Result */}
      {actionResult && (
        <div className={styles.actionResult}>
          <button className={styles.actionResultClose} onClick={() => setActionResult(null)}>✕</button>
          <p>{actionResult}</p>
        </div>
      )}

      {/* Visualizer Area */}
      <div className={styles.visualizerArea}>
        {conversation.isSpeaking ? (
          <div className={styles.voiceWave}>
             {[...Array(5)].map((_, i) => (
                <div key={i} className={styles.bar} style={{ animationDelay: `${i * 0.15}s` }}></div>
             ))}
          </div>
        ) : isStarted && !micMuted ? (
           <div className={styles.listeningText}>Listening...</div>
        ) : isStarted ? (
           <div className={styles.pausedText}>Ready</div>
        ) : null}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.controlIcon} onClick={goPrev}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 20L9 12L19 4V20ZM7 20H5V4H7V20Z"/></svg>
        </button>

        {isStarted ? (
          <>
            <button className={styles.stopBtn} onClick={stopBriefing}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </button>

            <button
              className={`${styles.micBtn} ${!micMuted ? styles.micActive : ''}`}
              onClick={() => setMicMuted(m => !m)}
            >
              {micMuted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .72-.11 1.41-.3 2.06"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              )}
            </button>
          </>
        ) : (
          <button className={styles.briefingBtn} onClick={startBriefing}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
            Briefing
          </button>
        )}

        <button className={styles.controlIcon} onClick={goNext}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M5 4L15 12L5 20V4ZM17 4H19V20H17V4Z"/></svg>
        </button>
      </div>

      {isSettingsOpen && <SettingsModal onClose={handleSettingsClose} />}
    </div>
  );
}
