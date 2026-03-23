import { useState } from 'react';
import styles from './Onboarding.module.css';

const interestsList = ['Tech', 'Business', 'Sports', 'Gaming', 'Politics', 'Science'];
const languagesList = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];
const citiesList = ['New York', 'London', 'Mumbai', 'Tokyo', 'San Francisco'];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLang, setSelectedLang] = useState('en');
  const [location, setLocation] = useState('');

  const toggleInterest = (i: string) => {
    setSelectedInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  return (
    <div className={`screen ${styles.container} animate-slide-up`}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          style={{ visibility: step > 1 ? 'visible' : 'hidden' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.progress}>
          <div className={styles.bar} style={{ width: `${(step / 3) * 100}%` }} />
        </div>
        <div style={{ width: 24 }} /> {/* Spacer */}
      </div>

      <div className={styles.content}>
        {step === 1 && (
          <div className="animate-slide-up">
            <h1 className="headline">What are you interested in?</h1>
            <p className="summary" style={{ marginTop: '8px', marginBottom: '32px' }}>
              Select at least one category
            </p>

            <div className={styles.grid}>
              {interestsList.map((i) => (
                <button
                  key={i}
                  className={`${styles.chip} ${
                    selectedInterests.includes(i) ? styles.activeChip : ''
                  }`}
                  onClick={() => toggleInterest(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-slide-up">
            <h1 className="headline">Choose your language</h1>
            <p className="summary" style={{ marginTop: '8px', marginBottom: '32px' }}>
              You can change this anytime
            </p>

            <div className={styles.list}>
              {languagesList.map((l) => (
                <button
                  key={l.code}
                  className={`${styles.listItem} ${
                    selectedLang === l.code ? styles.activeListItem : ''
                  }`}
                  onClick={() => setSelectedLang(l.code)}
                >
                  <span>{l.name}</span>
                  {selectedLang === l.code && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17L4 12" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-slide-up">
            <h1 className="headline">Where are you located?</h1>
            <p className="summary" style={{ marginTop: '8px', marginBottom: '32px' }}>
              To get local news updates
            </p>

            <div className={styles.searchBox}>
              <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 21L16.65 16.65" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search city..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={styles.input}
              />
              <button className={styles.autoDetect}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{marginRight: 4}}>
                   <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                   <path d="M12 22C16 18 20 14.4183 20 10C20 5.58172 16.4183 2 12 2C7.58172 2 4 5.58172 4 10C4 14.4183 8 18 12 22Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Auto
              </button>
            </div>

            <p className="meta" style={{ marginTop: '32px', marginBottom: '16px' }}>
              Popular Cities
            </p>
            <div className={styles.wrapList}>
              {citiesList.map((c) => (
                <button
                  key={c}
                  className={`${styles.cityChip} ${location === c ? styles.activeCityChip : ''}`}
                  onClick={() => setLocation(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button
          className={`${styles.primaryBtn} ${
            step === 1 && selectedInterests.length === 0 ? styles.disabledBtn : ''
          }`}
          onClick={() => {
            if (step < 3) setStep((s) => s + 1);
            else onComplete();
          }}
          disabled={step === 1 && selectedInterests.length === 0}
        >
          {step === 3 ? "Let's Go" : "Continue"}
        </button>
      </div>
    </div>
  );
}
