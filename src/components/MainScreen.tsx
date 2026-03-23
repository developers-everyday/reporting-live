"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './MainScreen.module.css';
import SettingsModal from './SettingsModal';
import { useConversation } from '@elevenlabs/react';

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  imageUrl: string | null;
  sourceNames: string[];
  categories: string[];
  region: string | null;
}

export default function MainScreen({ userName }: { userName: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [micMuted, setMicMuted] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentIndexRef = useRef(currentIndex);
  const newsListRef = useRef(newsList);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { newsListRef.current = newsList; }, [newsList]);

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
    fetchNews();

    // Auto-trigger scrape on page load (respects 30min cooldown server-side)
    const refreshNews = async () => {
      try {
        setIsRefreshing(true);
        const res = await fetch('/api/scrape/trigger', { method: 'POST' });
        const data = await res.json();
        if (data.success && !data.skipped && data.newArticles > 0) {
          await fetchNews(); // Refetch feed with new articles
        }
      } catch (error) {
        console.error('Background scrape failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    };
    refreshNews();
  }, [fetchNews]);

  const currentNews = newsList[currentIndex];

  // Navigation helpers (also used by manual prev/next buttons)
  const goNext = useCallback(() => {
    const len = newsListRef.current.length;
    if (len === 0) return;
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
    }
  }, []);

  const goPrev = useCallback(() => {
    const len = newsListRef.current.length;
    if (len === 0) return;
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
      }
    }
  });

  const startBriefing = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // @ts-ignore
      await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '',
        dynamicVariables: {
          userName,
        }
      });
      setIsStarted(true);
    } catch (e) {
      console.error("Failed to start briefing:", e);
    }
  };

  const stopBriefing = async () => {
    await conversation.endSession();
    setIsStarted(false);
    setMicMuted(true);
  };

  // Refetch news when settings close (preferences may have changed)
  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
    fetchNews();
  };

  if (isLoading) {
    return (
      <div className={`screen ${styles.container}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading news...</div>
      </div>
    );
  }

  if (newsList.length === 0) {
    return (
      <div className={`screen ${styles.container}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          <p>No news articles yet.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>Check back soon!</p>
        </div>
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
        <button className={styles.iconBtn} onClick={() => setIsSettingsOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
             <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
             <path d="M19.4 15A1.65 1.65 0 0 0 21 13.35V10.65A1.65 1.65 0 0 0 19.4 9H18.6A3.4 3.4 0 0 1 15 5.4V4.6A1.65 1.65 0 0 0 13.35 3H10.65A1.65 1.65 0 0 0 9 4.6V5.4A3.4 3.4 0 0 1 5.4 9H4.6A1.65 1.65 0 0 0 3 10.65V13.35A1.65 1.65 0 0 0 4.6 15H5.4A3.4 3.4 0 0 1 9 18.6V19.4A1.65 1.65 0 0 0 10.65 21H13.35A1.65 1.65 0 0 0 15 19.4V18.6A3.4 3.4 0 0 1 18.6 15H19.4Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className={styles.liveIndicator}>
         <div className={styles.livePulse}></div>
         {isRefreshing ? 'FETCHING FRESH NEWS...' : 'LIVE REPORTING'}
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {currentNews && (
          <>
            <div key={currentNews.id} className={`${styles.newsCard} animate-slide-up`}>
              {currentNews.imageUrl && (
                <div className={styles.newsImageContainer}>
                  <img
                    src={currentNews.imageUrl}
                    alt={currentNews.headline}
                    className={styles.newsImage}
                  />
                </div>
              )}
              <h2 className="headline" style={{ marginBottom: 16 }}>{currentNews.headline}</h2>
              <p className="summary">{currentNews.summary}</p>
            </div>

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
          </>
        )}
      </div>

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
