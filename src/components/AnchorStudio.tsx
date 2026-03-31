"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAgent } from "agents/react";
import { useRouter } from "next/navigation";
import styles from "./AnchorStudio.module.css";

interface AnchorState {
  status:
    | "idle"
    | "designing"
    | "previewing"
    | "creating"
    | "ready"
    | "error";
  error?: string;
}

interface VoicePreview {
  generatedVoiceId: string;
  audioBase64: string;
  mediaType: string;
  durationSecs: number;
}

const PERSONALITY_TRAITS = [
  "Authoritative",
  "Warm",
  "Energetic",
  "Calm",
  "Witty",
  "Serious",
  "Friendly",
  "Dramatic",
];

const VOICE_CHARACTERISTICS = [
  "Deep",
  "High-pitched",
  "Raspy",
  "Smooth",
  "Fast-paced",
  "Slow & deliberate",
  "British accent",
  "American accent",
];

const VOICE_GENDERS = ["Male", "Female", "Androgynous"] as const;
type VoiceGender = (typeof VOICE_GENDERS)[number];

interface SavedAnchor {
  voiceId: string;
  voiceName: string;
}

const STORAGE_KEY_ACTIVE = "reportinglive_custom_anchor";
const STORAGE_KEY_ALL = "reportinglive_all_anchors";

function loadActiveAnchor(): SavedAnchor | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadAllAnchors(): SavedAnchor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALL);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAllAnchors(anchors: SavedAnchor[]) {
  localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(anchors));
}

export default function AnchorStudio() {
  const router = useRouter();

  // Saved anchors state
  const [activeAnchor, setActiveAnchor] = useState<SavedAnchor | null>(null);
  const [savedAnchors, setSavedAnchors] = useState<SavedAnchor[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  // Load saved anchors on mount — migrate legacy active anchor into the list
  useEffect(() => {
    const active = loadActiveAnchor();
    let all = loadAllAnchors();
    // Migrate: if there's an active anchor that isn't in the saved list, add it
    if (active && !all.some((a) => a.voiceId === active.voiceId)) {
      all = [...all, active];
      saveAllAnchors(all);
    }
    setActiveAnchor(active);
    setSavedAnchors(all);
    // If no anchors exist, show wizard directly
    if (all.length === 0) setShowWizard(true);
  }, []);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<
    string[]
  >([]);
  const [anchorName, setAnchorName] = useState("");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("Male");
  const [previews, setPreviews] = useState<VoicePreview[]>([]);
  const [voiceDescription, setVoiceDescription] = useState("");
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(
    null
  );
  const [createdVoice, setCreatedVoice] = useState<{
    voiceId: string;
    voiceName: string;
  } | null>(null);
  const [testText, setTestText] = useState(
    "Breaking news tonight. A major development has shaken the global markets."
  );

  // Loading/error
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);

  // Audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const switchAnchor = (anchor: SavedAnchor) => {
    localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(anchor));
    setActiveAnchor(anchor);
  };

  const useDefaultVoice = () => {
    localStorage.removeItem(STORAGE_KEY_ACTIVE);
    setActiveAnchor(null);
  };

  const deleteAnchor = (voiceId: string) => {
    const updated = savedAnchors.filter((a) => a.voiceId !== voiceId);
    setSavedAnchors(updated);
    saveAllAnchors(updated);
    if (activeAnchor?.voiceId === voiceId) {
      useDefaultVoice();
    }
  };

  const startNewAnchor = () => {
    setShowWizard(true);
    setStep(1);
    setSelectedTraits([]);
    setSelectedCharacteristics([]);
    setAnchorName("");
    setVoiceGender("Male");
    setPreviews([]);
    setVoiceDescription("");
    setSelectedPreviewId(null);
    setCreatedVoice(null);
    setError(null);
  };

  // Connect to AnchorAgent
  const agent = useAgent<AnchorState>({
    agent: "anchor-agent",
    name: "studio",
    host: process.env.NEXT_PUBLIC_AGENTS_URL || "http://localhost:8787",
    query: { apiKey: process.env.NEXT_PUBLIC_AGENTS_API_KEY || "" },
    onStateUpdate: (state) => {
      if (state?.status) setAgentStatus(state.status);
      if (state?.error) setError(state.error);
    },
  });

  const toggleChip = (
    item: string,
    selected: string[],
    setter: (v: string[]) => void
  ) => {
    setter(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item]
    );
  };

  const playAudio = (base64: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audioRef.current = audio;
    setPlayingId(id);
    audio.play();
    audio.onended = () => setPlayingId(null);
  };

  // Step 1: Generate voice previews
  const handleDesign = useCallback(async () => {
    if (!anchorName.trim() || selectedTraits.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = (await agent.call("generateVoicePreviews", [
        selectedTraits,
        [...selectedCharacteristics, `${voiceGender} voice`],
        anchorName,
      ])) as { previews: VoicePreview[]; voiceDescription: string };
      setPreviews(result.previews);
      setVoiceDescription(result.voiceDescription);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setIsLoading(false);
    }
  }, [agent, anchorName, selectedTraits, selectedCharacteristics]);

  // Step 2 → 3: Create permanent voice
  const handleCreateVoice = useCallback(async () => {
    if (!selectedPreviewId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = (await agent.call("createVoice", [
        selectedPreviewId,
        anchorName,
        voiceDescription,
      ])) as { voiceId: string; voiceName: string };
      setCreatedVoice(result);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create voice");
    } finally {
      setIsLoading(false);
    }
  }, [agent, selectedPreviewId, anchorName, voiceDescription]);

  // Step 3: Test the created voice
  const handleTestVoice = useCallback(async () => {
    if (!createdVoice || !testText.trim()) return;
    setIsLoading(true);
    try {
      const result = (await agent.call("testVoice", [
        createdVoice.voiceId,
        testText,
      ])) as { audioBase64: string };
      playAudio(result.audioBase64, "test");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setIsLoading(false);
    }
  }, [agent, createdVoice, testText]);

  // Save and finish
  const handleDone = () => {
    if (createdVoice) {
      // Save as active anchor
      localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(createdVoice));
      setActiveAnchor(createdVoice);
      // Add to saved anchors list (avoid duplicates)
      const updated = savedAnchors.filter((a) => a.voiceId !== createdVoice.voiceId);
      updated.push(createdVoice);
      setSavedAnchors(updated);
      saveAllAnchors(updated);
    }
    setShowWizard(false);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => showWizard && savedAnchors.length > 0 ? setShowWizard(false) : router.push("/")}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.headerTitle}>Anchor Studio</div>
        <div style={{ width: 36 }} />
      </div>

      {/* Anchor Management View */}
      {!showWizard && (
        <div className={styles.stepContent}>
          {/* Current Active Anchor */}
          <div className={styles.currentAnchorCard}>
            <div className={styles.currentAnchorLabel}>Current Anchor</div>
            <div className={styles.currentAnchorName}>
              {activeAnchor ? activeAnchor.voiceName : "Default Voice"}
            </div>
            {activeAnchor && (
              <button className={styles.defaultBtn} onClick={useDefaultVoice}>
                Switch to Default
              </button>
            )}
          </div>

          {/* Saved Anchors */}
          {savedAnchors.length > 0 && (
            <div className={styles.section}>
              <label className={styles.sectionLabel}>Your Anchors</label>
              <div className={styles.anchorList}>
                {savedAnchors.map((anchor) => (
                  <div
                    key={anchor.voiceId}
                    className={`${styles.anchorItem} ${activeAnchor?.voiceId === anchor.voiceId ? styles.anchorItemActive : ""}`}
                  >
                    <div className={styles.anchorItemInfo}>
                      <span className={styles.anchorItemName}>{anchor.voiceName}</span>
                      {activeAnchor?.voiceId === anchor.voiceId && (
                        <span className={styles.activeBadge}>Active</span>
                      )}
                    </div>
                    <div className={styles.anchorItemActions}>
                      {activeAnchor?.voiceId !== anchor.voiceId && (
                        <button
                          className={styles.switchBtn}
                          onClick={() => switchAnchor(anchor)}
                        >
                          Use
                        </button>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => deleteAnchor(anchor.voiceId)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className={styles.primaryBtn} onClick={startNewAnchor}>
            + Create New Anchor
          </button>
        </div>
      )}

      {/* Wizard View */}
      {showWizard && <>
      {/* Step Indicator */}
      <div className={styles.steps}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`${styles.stepDot} ${s === step ? styles.stepActive : ""} ${s < step ? styles.stepDone : ""}`}
          />
        ))}
      </div>

      {/* Error */}
      {error && <p className={styles.errorText}>{error}</p>}

      {/* Step 1: Personality Selection */}
      {step === 1 && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Design Your Anchor</h2>
          <p className={styles.stepSubtitle}>
            Choose personality traits and voice characteristics
          </p>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Personality</label>
            <div className={styles.chipGrid}>
              {PERSONALITY_TRAITS.map((trait) => (
                <button
                  key={trait}
                  className={`${styles.chip} ${selectedTraits.includes(trait) ? styles.chipSelected : ""}`}
                  onClick={() =>
                    toggleChip(trait, selectedTraits, setSelectedTraits)
                  }
                >
                  {trait}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Voice Style</label>
            <div className={styles.chipGrid}>
              {VOICE_CHARACTERISTICS.map((char) => (
                <button
                  key={char}
                  className={`${styles.chip} ${selectedCharacteristics.includes(char) ? styles.chipSelected : ""}`}
                  onClick={() =>
                    toggleChip(
                      char,
                      selectedCharacteristics,
                      setSelectedCharacteristics
                    )
                  }
                >
                  {char}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Voice Gender</label>
            <div className={styles.chipGrid}>
              {VOICE_GENDERS.map((gender) => (
                <button
                  key={gender}
                  className={`${styles.chip} ${voiceGender === gender ? styles.chipSelected : ""}`}
                  onClick={() => setVoiceGender(gender)}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Anchor Name</label>
            <input
              type="text"
              className={styles.textInput}
              placeholder="e.g., Alex Morgan"
              value={anchorName}
              onChange={(e) => setAnchorName(e.target.value)}
            />
          </div>

          <button
            className={styles.primaryBtn}
            onClick={handleDesign}
            disabled={
              isLoading || !anchorName.trim() || selectedTraits.length === 0
            }
          >
            {isLoading ? (
              <span className={styles.spinner} />
            ) : (
              "Design My Anchor"
            )}
          </button>
        </div>
      )}

      {/* Step 2: Voice Previews */}
      {step === 2 && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Choose a Voice</h2>
          <p className={styles.stepSubtitle}>{voiceDescription}</p>

          <div className={styles.previewList}>
            {previews.map((preview, i) => (
              <div
                key={preview.generatedVoiceId}
                className={`${styles.previewCard} ${selectedPreviewId === preview.generatedVoiceId ? styles.previewSelected : ""}`}
              >
                <div className={styles.previewHeader}>
                  <span className={styles.previewLabel}>Voice {i + 1}</span>
                  <span className={styles.previewDuration}>
                    {preview.durationSecs.toFixed(1)}s
                  </span>
                </div>
                <div className={styles.previewActions}>
                  <button
                    className={styles.previewPlayBtn}
                    onClick={() =>
                      playAudio(
                        preview.audioBase64,
                        preview.generatedVoiceId
                      )
                    }
                  >
                    {playingId === preview.generatedVoiceId ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                  <button
                    className={`${styles.selectBtn} ${selectedPreviewId === preview.generatedVoiceId ? styles.selectBtnActive : ""}`}
                    onClick={() =>
                      setSelectedPreviewId(preview.generatedVoiceId)
                    }
                  >
                    {selectedPreviewId === preview.generatedVoiceId
                      ? "Selected"
                      : "Select"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            className={styles.primaryBtn}
            onClick={handleCreateVoice}
            disabled={isLoading || !selectedPreviewId}
          >
            {isLoading ? (
              <span className={styles.spinner} />
            ) : (
              "Create This Voice"
            )}
          </button>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && createdVoice && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Voice Created!</h2>
          <p className={styles.stepSubtitle}>
            {createdVoice.voiceName} is ready. Test it below.
          </p>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Test Your Anchor</label>
            <textarea
              className={styles.textArea}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={3}
            />
            <button
              className={styles.secondaryBtn}
              onClick={handleTestVoice}
              disabled={isLoading}
            >
              {isLoading ? <span className={styles.spinner} /> : "Play Test"}
            </button>
          </div>

          <button className={styles.primaryBtn} onClick={handleDone}>
            Save Anchor
          </button>
        </div>
      )}
      </>}
    </div>
  );
}
