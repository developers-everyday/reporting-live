import { useState } from 'react';
import styles from './SettingsModal.module.css';

const INTERESTS = ['Tech', 'Business', 'Sports', 'Gaming', 'Politics', 'Science', 'Entertainment'];
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' }
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [location, setLocation] = useState('San Francisco');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Tech', 'Business']);
  const [language, setLanguage] = useState('en');

  const toggleInterest = (i: string) => {
    setSelectedInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={`${styles.modal} animate-slide-up`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className="headline">Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Premium Status</div>
          <div className={styles.premiumCard}>
             <div className={styles.premiumInfo}>
                <h3>Live Reporting Free</h3>
                <p>Limited queries per day</p>
             </div>
             <button className={styles.upgradeBtn}>Upgrade</button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Location Preferences</div>
          <div className={styles.inputGroup}>
            <input 
              className={styles.input} 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter city..."
            />
            <button className={styles.autoBtn}>Auto</button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>News Interests</div>
          <div className={styles.chipGrid}>
            {INTERESTS.map(i => (
              <button 
                key={i} 
                className={`${styles.chip} ${selectedInterests.includes(i) ? styles.activeChip : ''}`}
                onClick={() => toggleInterest(i)}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Reporting Language</div>
          <select 
            className={styles.input} 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ width: '100%', appearance: 'none' }}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
