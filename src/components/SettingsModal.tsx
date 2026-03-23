"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser, SignOutButton } from '@clerk/nextjs';
import styles from './SettingsModal.module.css';

const INTERESTS = ['Tech', 'Business', 'Sports', 'Gaming', 'Politics', 'Science'];
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' }
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  const [location, setLocation] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/user/preferences')
      .then((res) => res.json())
      .then((data) => {
        setLocation(data.location || '');
        setSelectedInterests(data.interests || []);
        setLanguage(data.language || 'en');
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const toggleInterest = (i: string) => {
    setSelectedInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interests: selectedInterests,
          language,
          location: location || null,
        }),
      });
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedInterests, language, location, onClose]);

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

        {isLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading...
          </div>
        ) : (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Account</div>
              <div className={styles.premiumCard}>
                <div className={styles.premiumInfo}>
                  <h3>{user?.fullName || 'User'}</h3>
                  <p>{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
                <SignOutButton>
                  <button className={styles.upgradeBtn}>Sign Out</button>
                </SignOutButton>
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

            <div className={styles.section}>
              <button
                className={styles.upgradeBtn}
                style={{ width: '100%', padding: '12px' }}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
