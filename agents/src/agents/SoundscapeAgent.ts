import { Agent, callable } from "agents";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { Env } from "../types";
import { createElevenLabsClient, toBase64 } from "../types";

interface SoundscapeState {
  status: "idle" | "analyzing" | "generating" | "complete" | "error";
  articleHeadline?: string;
  sceneDescription?: string;
  narrationText?: string;
  error?: string;
}

interface SoundscapeResult {
  narrationAudioBase64: string;
  ambientAudioBase64: string;
  sceneDescription: string;
  narrationText: string;
}

interface AmbientAudioResult {
  ambientAudioBase64: string;
  sceneDescription: string;
  durationSeconds: number;
  loop: boolean;
}

export class SoundscapeAgent extends Agent<Env, SoundscapeState> {
  initialState: SoundscapeState = { status: "idle" };

  @callable()
  async generateSoundscape(
    articleHeadline: string,
    articleSummary: string,
    voiceId?: string
  ): Promise<SoundscapeResult> {
    try {
      // Step 1: Analyze article with Workers AI
      this.setState({
        ...this.state,
        status: "analyzing",
        articleHeadline,
      });

      console.log("[SoundscapeAgent] Starting analysis for:", articleHeadline);

      const workersai = createWorkersAI({ binding: this.env.AI });
      const model = workersai("@cf/meta/llama-3.1-70b-instruct", {
        sessionAffinity: this.sessionAffinity,
      });

      const { text } = await generateText({
        model,
        system: `You are an audio scene designer for a news broadcast app.
Given a news headline and summary, produce:
1. sceneDescription: A vivid 10-20 word description of ambient sounds matching the story's setting (e.g., "rainy city street with distant traffic and police sirens"). Be specific about sounds, not visuals.
2. narrationText: A broadcast-ready 2-3 sentence narration of the story (60-90 words), natural for text-to-speech. Do not use any formatting or special characters.
Return valid JSON only: { "sceneDescription": "...", "narrationText": "..." }`,
        prompt: `Headline: ${articleHeadline}\nSummary: ${articleSummary}`,
      });

      console.log("[SoundscapeAgent] LLM response:", text);

      let parsed: { sceneDescription: string; narrationText: string };
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to parse LLM response as JSON: " + text.slice(0, 200));
        }
      }

      const { sceneDescription, narrationText } = parsed;
      console.log("[SoundscapeAgent] Scene:", sceneDescription);
      console.log("[SoundscapeAgent] Narration length:", narrationText.length);

      // Step 2: Generate audio with ElevenLabs (parallel)
      this.setState({
        ...this.state,
        status: "generating",
        sceneDescription,
        narrationText,
      });

      const elevenlabs = createElevenLabsClient(this.env.ELEVENLABS_API_KEY);
      const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel

      console.log("[SoundscapeAgent] Calling ElevenLabs APIs...");

      // Call ElevenLabs APIs separately to catch individual errors
      let ambientResult: unknown;
      let narrationResult: unknown;

      try {
        console.log("[SoundscapeAgent] Generating sound effects...");
        ambientResult = await elevenlabs.textToSoundEffects.convert({
          text: sceneDescription,
          durationSeconds: 15,
        });
        console.log("[SoundscapeAgent] Sound FX result type:", typeof ambientResult, Object.keys(ambientResult as object || {}));
      } catch (sfxError) {
        console.error("[SoundscapeAgent] Sound FX error:", sfxError);
        throw new Error("Sound FX generation failed: " + (sfxError instanceof Error ? sfxError.message : String(sfxError)));
      }

      try {
        console.log("[SoundscapeAgent] Generating TTS...");
        narrationResult = await elevenlabs.textToSpeech.convert(
          voiceId || defaultVoiceId,
          {
            text: narrationText,
            modelId: "eleven_multilingual_v2",
          }
        );
        console.log("[SoundscapeAgent] TTS result type:", typeof narrationResult, Object.keys(narrationResult as object || {}));
      } catch (ttsError) {
        console.error("[SoundscapeAgent] TTS error:", ttsError);
        throw new Error("TTS generation failed: " + (ttsError instanceof Error ? ttsError.message : String(ttsError)));
      }

      console.log("[SoundscapeAgent] Converting to base64...");

      const [ambientAudioBase64, narrationAudioBase64] = await Promise.all([
        toBase64(ambientResult),
        toBase64(narrationResult),
      ]);

      console.log("[SoundscapeAgent] Ambient audio size:", ambientAudioBase64.length);
      console.log("[SoundscapeAgent] Narration audio size:", narrationAudioBase64.length);

      // Step 3: Complete
      this.setState({
        ...this.state,
        status: "complete",
      });

      return {
        narrationAudioBase64,
        ambientAudioBase64,
        sceneDescription,
        narrationText,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[SoundscapeAgent] Error:", message);
      this.setState({
        ...this.state,
        status: "error",
        error: message,
      });
      throw error;
    }
  }

  /**
   * Generate only ambient sound effects for an article, intended for use
   * during immersive live briefings. Does NOT generate narration TTS — the
   * Conversational Agent handles voice in live mode.
   *
   * Callers should treat failures as non-fatal — if this fails, the briefing
   * should continue without ambient audio.
   */
  @callable()
  async generateAmbientAudio(
    articleHeadline: string,
    articleSummary: string,
    durationSeconds?: number
  ): Promise<AmbientAudioResult> {
    const duration = durationSeconds ?? 15;

    try {
      // Step 1: Analyze article for ambient scene description
      this.setState({
        ...this.state,
        status: "analyzing",
        articleHeadline,
      });

      console.log("[SoundscapeAgent] Generating ambient audio for:", articleHeadline);

      const workersai = createWorkersAI({ binding: this.env.AI });
      const MODELS = [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-3.1-8b-instruct",
      ] as const;

      let sceneDescription: string | null = null;

      for (const modelId of MODELS) {
        try {
          console.log("[SoundscapeAgent] Trying model:", modelId);
          const model = workersai(modelId, {
            sessionAffinity: this.sessionAffinity,
          });

          const { text } = await generateText({
            model,
            system: `You are an ambient sound designer for a news broadcast app.
Given a news headline and summary, produce a vivid 10-20 word description of ambient sounds matching the story's setting.
Focus on specific sounds (e.g., "steady rain on pavement with distant thunder and muffled city traffic"), not visuals or music.
Return valid JSON only: { "sceneDescription": "..." }`,
            prompt: `Headline: ${articleHeadline}\nSummary: ${articleSummary}`,
          });

          console.log("[SoundscapeAgent] Ambient LLM response:", text);

          let parsed: { sceneDescription: string };
          try {
            parsed = JSON.parse(text);
          } catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsed = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("Failed to parse LLM response as JSON: " + text.slice(0, 200));
            }
          }

          sceneDescription = parsed.sceneDescription;
          console.log("[SoundscapeAgent] Ambient scene:", sceneDescription);
          break;
        } catch (modelErr) {
          console.warn("[SoundscapeAgent] Model", modelId, "failed:", modelErr instanceof Error ? modelErr.message : modelErr);
        }
      }

      if (!sceneDescription) {
        // All models failed — use a generic scene derived from the headline
        sceneDescription = `busy newsroom with papers rustling, keyboards typing, and muffled television chatter`;
        console.log("[SoundscapeAgent] Using fallback scene:", sceneDescription);
      }

      // Step 2: Generate loopable sound effects
      this.setState({
        ...this.state,
        status: "generating",
        sceneDescription,
      });

      const elevenlabs = createElevenLabsClient(this.env.ELEVENLABS_API_KEY);

      console.log("[SoundscapeAgent] Generating loopable ambient SFX...");

      const ambientResult = await elevenlabs.textToSoundEffects.convert({
        text: sceneDescription,
        durationSeconds: duration,
        loop: true,
        modelId: "eleven_text_to_sound_v2",
      });

      const ambientAudioBase64 = await toBase64(ambientResult);
      console.log("[SoundscapeAgent] Ambient audio size:", ambientAudioBase64.length);

      // Step 3: Complete
      this.setState({
        ...this.state,
        status: "complete",
      });

      return {
        ambientAudioBase64,
        sceneDescription,
        durationSeconds: duration,
        loop: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[SoundscapeAgent] Ambient error:", message);
      this.setState({
        ...this.state,
        status: "error",
        error: message,
      });
      throw error;
    }
  }
}
