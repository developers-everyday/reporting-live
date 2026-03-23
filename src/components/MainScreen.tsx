import { useState, useEffect } from 'react';
import styles from './MainScreen.module.css';

type AppState = 'playing' | 'paused' | 'listening' | 'answering';

const newsList = [
  {
    id: 1,
    headline: "OpenAI announces new reasoning capabilities for Strawberry model",
    summary: "The new model showcases advanced multi-step reasoning, drastically reducing hallucination rates across complex logic challenges.",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
    sources: ["BBC News", "Reuters"]
  },
  {
    id: 2,
    headline: "SpaceX successfully launches Starship on highly anticipated test flight",
    summary: "The latest launch milestone brings humanity one step closer to making interplanetary travel a routine endeavor.",
    image: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=800&q=80",
    sources: ["Space.com", "NASA", "AP"]
  },
  {
    id: 3,
    headline: "Global stock markets reach record highs amidst tech rally",
    summary: "Investors are optimistic as technology giants continue to report massive earnings growth for the third consecutive quarter.",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
    sources: ["Bloomberg", "Financial Times"]
  }
];

export default function MainScreen() {
  const [appState, setAppState] = useState<AppState>('playing');
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentNews = newsList[currentIndex];

  const goNext = () => setCurrentIndex((i) => (i + 1) % newsList.length);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + newsList.length) % newsList.length);

  // Simulate returning to playing after answering
  useEffect(() => {
    if (appState === 'answering') {
      const timer = setTimeout(() => setAppState('playing'), 5000);
      return () => clearTimeout(timer);
    }
  }, [appState]);

  return (
    <div className={`screen ${styles.container} animate-slide-up`}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.location}>
          <span className={styles.dot}></span>
          San Francisco
        </div>
        <button className={styles.iconBtn}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
             <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
             <path d="M19.4 15A1.65 1.65 0 0 0 21 13.35V10.65A1.65 1.65 0 0 0 19.4 9H18.6A3.4 3.4 0 0 1 15 5.4V4.6A1.65 1.65 0 0 0 13.35 3H10.65A1.65 1.65 0 0 0 9 4.6V5.4A3.4 3.4 0 0 1 5.4 9H4.6A1.65 1.65 0 0 0 3 10.65V13.35A1.65 1.65 0 0 0 4.6 15H5.4A3.4 3.4 0 0 1 9 18.6V19.4A1.65 1.65 0 0 0 10.65 21H13.35A1.65 1.65 0 0 0 15 19.4V18.6A3.4 3.4 0 0 1 18.6 15H19.4Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className={styles.liveIndicator}>
         <div className={styles.livePulse}></div>
         LIVE REPORTING
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        <div key={currentNews.id} className={`${styles.newsCard} animate-slide-up`}>
          <div className={styles.newsImageContainer}>
            <img 
              src={currentNews.image} 
              alt={currentNews.headline} 
              className={styles.newsImage} 
            />
          </div>
          <h2 className="headline" style={{ marginBottom: 16 }}>{currentNews.headline}</h2>
          <p className="summary">{currentNews.summary}</p>
        </div>

        {/* Verified Sources */}
        <div className={styles.sourcesWrapper}>
          <div className={styles.sourcesTitle}>VERIFIED SOURCES</div>
          <div className={styles.sourcesList}>
            {currentNews.sources.map((src) => (
              <div key={src} className={styles.sourceChip}>
                <span className={styles.checkIcon}>✓</span> {src}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visualizer Area */}
      <div className={styles.visualizerArea}>
        {appState === 'playing' || appState === 'answering' ? (
          <div className={styles.voiceWave}>
             {[...Array(5)].map((_, i) => (
                <div key={i} className={styles.bar} style={{ animationDelay: `${i * 0.15}s` }}></div>
             ))}
          </div>
        ) : appState === 'listening' ? (
           <div className={styles.listeningText}>Listening...</div>
        ) : (
           <div className={styles.pausedText}>Paused</div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.controlIcon} onClick={goPrev}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 20L9 12L19 4V20ZM7 20H5V4H7V20Z"/></svg>
        </button>

        <button 
           className={styles.controlIcon}
           onClick={() => setAppState(appState === 'paused' ? 'playing' : 'paused')}
           disabled={appState === 'listening' || appState === 'answering'}
        >
          {appState === 'paused' ? (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M5 3L19 12L5 21V3Z"/></svg>
          ) : (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 4H10V20H6V4ZM14 4H18V20H14V4Z"/></svg>
          )}
        </button>
        
        <button 
          className={`${styles.askBtn} ${appState === 'listening' ? styles.askPulse : ''}`}
          onClick={() => {
            if (appState === 'listening') {
              setAppState('answering');
            } else {
              setAppState('listening');
            }
          }}
        >
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
           </svg>
           {appState === 'listening' ? 'Stop' : 'Ask'}
        </button>

        <button className={styles.controlIcon} onClick={goNext}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M5 4L15 12L5 20V4ZM17 4H19V20H17V4Z"/></svg>
        </button>
      </div>
    </div>
  );
}
