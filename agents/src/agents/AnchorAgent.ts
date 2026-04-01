import { Agent, callable } from "agents";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { Env } from "../types";
import { createElevenLabsClient, toBase64 } from "../types";

interface VoicePreview {
  generatedVoiceId: string;
  audioBase64: string;
  mediaType: string;
  durationSecs: number;
}

interface AnchorState {
  status: "idle" | "designing" | "previewing" | "creating" | "ready" | "error";
  personalityTraits?: string[];
  voiceCharacteristics?: string[];
  anchorName?: string;
  voiceDescription?: string;
  previews?: VoicePreview[];
  selectedVoiceId?: string;
  error?: string;
}

export class AnchorAgent extends Agent<Env, AnchorState> {
  initialState: AnchorState = { status: "idle" };

  @callable()
  async generateVoicePreviews(
    personalityTraits: string[],
    voiceCharacteristics: string[],
    anchorName: string
  ): Promise<{ previews: VoicePreview[]; voiceDescription: string }> {
    try {
      this.setState({
        ...this.state,
        status: "designing",
        personalityTraits,
        voiceCharacteristics,
        anchorName,
      });

      // Generate voice description using Workers AI
      const workersai = createWorkersAI({ binding: this.env.AI });
      const model = workersai("@cf/meta/llama-3.1-70b-instruct", {
        sessionAffinity: this.sessionAffinity,
      });

      const { text: voiceDescription } = await generateText({
        model,
        system: `You are an expert voice casting director for a news broadcast app.
Given personality traits and voice characteristics, write a detailed voice description (2-3 sentences) that ElevenLabs Voice Design API can use to generate the perfect news anchor voice.
Focus on: pitch, pace, tone, accent, energy level, and emotional quality.
Example: "A warm, confident baritone voice with a slight Mid-Atlantic accent, speaking at a moderate pace with authoritative gravitas suitable for delivering breaking news."
Return only the voice description text, nothing else.`,
        prompt: `Personality traits: ${personalityTraits.join(", ")}
Voice characteristics: ${voiceCharacteristics.join(", ")}
Anchor name: ${anchorName}`,
      });

      // Generate voice previews with ElevenLabs
      this.setState({
        ...this.state,
        status: "previewing",
        voiceDescription,
      });

      const elevenlabs = createElevenLabsClient(this.env.ELEVENLABS_API_KEY);
      const response = await elevenlabs.textToVoice.createPreviews({
        voiceDescription,
        outputFormat: "mp3_22050_32",
        text: `Good evening, I'm ${anchorName}. Welcome to Reporting Live, your trusted source for breaking news and in-depth analysis. Here are tonight's top stories from around the world.`,
      });

      const previews: VoicePreview[] = (response.previews || []).map(
        (p) => ({
          generatedVoiceId: p.generatedVoiceId,
          audioBase64: p.audioBase64,
          mediaType: p.mediaType,
          durationSecs: p.durationSecs,
        })
      );

      this.setState({
        ...this.state,
        previews,
      });

      return { previews, voiceDescription };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({ ...this.state, status: "error", error: message });
      throw error;
    }
  }

  @callable()
  async createVoice(
    generatedVoiceId: string,
    voiceName: string,
    voiceDescription: string
  ): Promise<{ voiceId: string; voiceName: string }> {
    try {
      this.setState({ ...this.state, status: "creating" });

      const elevenlabs = createElevenLabsClient(this.env.ELEVENLABS_API_KEY);
      const voice = await elevenlabs.textToVoice.create({
        voiceName,
        voiceDescription,
        generatedVoiceId,
      });

      const voiceId = voice.voiceId;
      this.setState({
        ...this.state,
        status: "ready",
        selectedVoiceId: voiceId,
      });

      return { voiceId, voiceName };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({ ...this.state, status: "error", error: message });
      throw error;
    }
  }

  @callable()
  async testVoice(
    voiceId: string,
    sampleText: string
  ): Promise<{ audioBase64: string }> {
    try {
      const elevenlabs = createElevenLabsClient(this.env.ELEVENLABS_API_KEY);
      const result = await elevenlabs.textToSpeech.convert(voiceId, {
        text: sampleText,
        modelId: "eleven_multilingual_v2",
      });

      const audioBase64 = await toBase64(result);
      return { audioBase64 };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({ ...this.state, status: "error", error: message });
      throw error;
    }
  }
}
