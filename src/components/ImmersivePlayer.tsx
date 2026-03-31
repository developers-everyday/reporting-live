"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAgent } from "agents/react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./ImmersivePlayer.module.css";

interface SoundscapeState {
  status: "idle" | "analyzing" | "generating" | "complete" | "error";
  articleHeadline?: string;
  sceneDescription?: string;
  narrationText?: string;
  error?: string;
}

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  imageUrl: string | null;
  categories: string[];
}

const STATUS_MESSAGES: Record<string, string> = {
  idle: "Ready to generate",
  analyzing: "Analyzing article with AI...",
  generating: "Generating soundscape & narration...",
  complete: "Soundscape ready!",
  error: "Something went wrong",
};

export default function ImmersivePlayer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const articleId = searchParams.get("articleId");

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [soundscapeData, setSoundscapeData] = useState<{
    narrationAudioBase64: string;
    ambientAudioBase64: string;
    sceneDescription: string;
    narrationText: string;
  } | null>(null);
  const [agentStatus, setAgentStatus] = useState<string>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.3);
  const [error, setError] = useState<string | null>(null);

  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<HTMLAudioElement | null>(null);

  // Connect to SoundscapeAgent
  const agent = useAgent<SoundscapeState>({
    agent: "soundscape-agent",
    name: articleId || "default",
    host: process.env.NEXT_PUBLIC_AGENTS_URL || "http://localhost:8787",
    query: { apiKey: process.env.NEXT_PUBLIC_AGENTS_API_KEY || "" },
    onStateUpdate: (state) => {
      if (state?.status) {
        setAgentStatus(state.status);
        if (state.error) setError(state.error);
      }
    },
  });

  // Fetch article data
  useEffect(() => {
    if (!articleId) return;
    fetch(`/api/news/by-id?id=${articleId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.article) setArticle(data.article);
      })
      .catch(() => setError("Failed to load article"));
  }, [articleId]);

  const handleGenerate = useCallback(async () => {
    if (!article) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Check for custom anchor voice
      const savedAnchor = localStorage.getItem("reportinglive_custom_anchor");
      const customVoiceId = savedAnchor
        ? JSON.parse(savedAnchor).voiceId
        : undefined;

      const result = await agent.call("generateSoundscape", [
        article.headline,
        article.summary,
        customVoiceId,
      ]);
      setSoundscapeData(result as typeof soundscapeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [article, agent]);

  const handlePlay = useCallback(() => {
    if (!soundscapeData) return;

    if (isPlaying) {
      // Pause
      narrationRef.current?.pause();
      ambientRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const narrationAudio = new Audio(
      `data:audio/mpeg;base64,${soundscapeData.narrationAudioBase64}`
    );
    const ambientAudio = new Audio(
      `data:audio/mpeg;base64,${soundscapeData.ambientAudioBase64}`
    );
    ambientAudio.loop = true;
    ambientAudio.volume = ambientVolume;

    narrationRef.current = narrationAudio;
    ambientRef.current = ambientAudio;

    ambientAudio.play();
    narrationAudio.play();
    setIsPlaying(true);

    narrationAudio.onended = () => {
      // Fade out ambient
      const fadeOut = setInterval(() => {
        if (ambientAudio.volume > 0.05) {
          ambientAudio.volume = Math.max(0, ambientAudio.volume - 0.05);
        } else {
          clearInterval(fadeOut);
          ambientAudio.pause();
          setIsPlaying(false);
        }
      }, 200);
    };
  }, [soundscapeData, isPlaying, ambientVolume]);

  // Update ambient volume in real-time
  useEffect(() => {
    if (ambientRef.current && isPlaying) {
      ambientRef.current.volume = ambientVolume;
    }
  }, [ambientVolume, isPlaying]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      narrationRef.current?.pause();
      ambientRef.current?.pause();
    };
  }, []);

  if (!articleId) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>No article selected</p>
        <button className={styles.backBtn} onClick={() => router.push("/")}>
          Back to News
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/")}>
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
        <div className={styles.headerTitle}>Immersive Mode</div>
        <div style={{ width: 36 }} />
      </div>

      {/* Article Info */}
      {article && (
        <div className={styles.articleCard}>
          <div className={styles.category}>
            {article.categories?.[0] || "News"}
          </div>
          <h2 className={styles.headline}>{article.headline}</h2>
          <p className={styles.summary}>{article.summary}</p>
        </div>
      )}

      {/* Visualizer */}
      <div className={styles.visualizer}>
        <div
          className={`${styles.orb} ${isPlaying ? styles.orbPlaying : ""} ${isGenerating ? styles.orbGenerating : ""}`}
        >
          <div className={styles.orbInner} />
        </div>
      </div>

      {/* Status */}
      <div className={styles.statusSection}>
        <p className={styles.statusText}>
          {error || STATUS_MESSAGES[agentStatus] || agentStatus}
        </p>

        {soundscapeData?.sceneDescription && (
          <div className={styles.sceneCard}>
            <span className={styles.sceneLabel}>Scene</span>
            <p className={styles.sceneText}>
              {soundscapeData.sceneDescription}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {!soundscapeData ? (
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={isGenerating || !article}
          >
            {isGenerating ? (
              <span className={styles.spinner} />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            )}
            {isGenerating ? "Generating..." : "Generate Soundscape"}
          </button>
        ) : (
          <>
            <button className={styles.playBtn} onClick={handlePlay}>
              {isPlaying ? (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="white"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="white"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            <div className={styles.volumeControl}>
              <span className={styles.volumeLabel}>Ambient</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={ambientVolume}
                onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                className={styles.volumeSlider}
              />
            </div>
          </>
        )}
      </div>

      {/* Narration text */}
      {soundscapeData?.narrationText && (
        <div className={styles.narrationCard}>
          <span className={styles.narrationLabel}>Narration</span>
          <p className={styles.narrationText}>
            {soundscapeData.narrationText}
          </p>
        </div>
      )}
    </div>
  );
}
