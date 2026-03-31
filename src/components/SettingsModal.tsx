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
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/user/preferences')
      .then((res) => res.json())
      .then((data) => {
        setLocation(data.location || '');
        setSelectedInterests(data.interests || []);
        setLanguage(data.language || 'en');
        setCustomTopics(data.customTopics || []);
      })
      .catch(console.error);
  }, []);

  const toggleInterest = (i: string) => {
    setSelectedInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  const addTopic = () => {
    const topic = topicInput.trim();
    if (!topic) return;
    if (customTopics.some((t) => t.toLowerCase() === topic.toLowerCase())) return;
    if (customTopics.length >= 10) return;
    setCustomTopics((prev) => [...prev, topic]);
    setTopicInput('');
  };

  const removeTopic = (topic: string) => {
    setCustomTopics((prev) => prev.filter((t) => t !== topic));
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
          customTopics,
        }),
      });

      // Trigger topic search for each custom topic so articles are ready
      for (const topic of customTopics) {
        fetch('/api/news/topic-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: topic }),
        }).catch(console.error);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedInterests, language, location, customTopics, onClose]);

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
          <div className={styles.sectionTitle}>Anchor Studio</div>
          <p className={styles.sectionHint}>Clone your voice and become an AI news anchor</p>
          <button
            className={styles.anchorStudioBtn}
            onClick={() => { window.location.href = '/anchor-studio'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 18.5A2.5 2.5 0 0 1 7.5 20c-.3 0-.5-.2-.5-.5v-1a7 7 0 0 1 10 0v1c0 .3-.2.5-.5.5A2.5 2.5 0 0 1 12 18.5Z"/>
              <circle cx="12" cy="8" r="5"/>
              <path d="M10 8h4"/>
              <path d="M12 6v4"/>
            </svg>
            Open Anchor Studio
          </button>
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
          <div className={styles.sectionTitle}>Custom Topics</div>
          <p className={styles.sectionHint}>Add topics for personalized news</p>
          <div className={styles.inputGroup}>
            <input
              className={styles.input}
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTopic(); }}
              placeholder="e.g. AI, Formula 1, Climate..."
              maxLength={50}
            />
            <button
              className={styles.autoBtn}
              onClick={addTopic}
              disabled={!topicInput.trim() || customTopics.length >= 10}
            >
              Add
            </button>
          </div>
          {customTopics.length > 0 && (
            <div className={styles.topicChips}>
              {customTopics.map((topic) => (
                <span key={topic} className={styles.topicChip}>
                  {topic}
                  <button className={styles.topicRemove} onClick={() => removeTopic(topic)}>✕</button>
                </span>
              ))}
            </div>
          )}
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
      </div>
    </div>
  );
}
