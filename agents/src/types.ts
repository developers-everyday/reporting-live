import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export interface Env {
  AI: Ai;
  SOUNDSCAPE_AGENT: DurableObjectNamespace;
  ANCHOR_AGENT: DurableObjectNamespace;
  ELEVENLABS_API_KEY: string;
  API_KEY: string;
}

export function createElevenLabsClient(apiKey: string): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey });
}

export async function streamToBase64(
  stream: ReadableStream<Uint8Array>
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Use btoa with binary string for Workers runtime
  let binary = "";
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * Convert an ElevenLabs SDK response to base64.
 * Handles ReadableStream, BinaryResponse (with .arrayBuffer() or .stream()), etc.
 */
export async function toBase64(result: unknown): Promise<string> {
  if (result instanceof ReadableStream) {
    return streamToBase64(result);
  }
  if (
    result &&
    typeof (result as { arrayBuffer?: () => Promise<ArrayBuffer> })
      .arrayBuffer === "function"
  ) {
    const buffer = await (
      result as { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  if (
    result &&
    typeof (result as { stream?: () => ReadableStream }).stream === "function"
  ) {
    const stream = (result as { stream: () => ReadableStream }).stream();
    return streamToBase64(stream);
  }
  throw new Error("Unknown response type from ElevenLabs: " + typeof result);
}
