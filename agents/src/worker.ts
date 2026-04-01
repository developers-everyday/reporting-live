import { routeAgentRequest } from "agents";
import type { Env } from "./types";

// Re-export agent classes so Cloudflare wires them as Durable Objects
export { SoundscapeAgent } from "./agents/SoundscapeAgent";
export { AnchorAgent } from "./agents/AnchorAgent";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-API-Key, Upgrade, Connection",
};

function addCorsHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleImageGeneration(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const prompt = url.searchParams.get("prompt");
  if (!prompt) {
    return new Response("Missing prompt parameter", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    const seed = parseInt(url.searchParams.get("seed") || "0", 10) || undefined;

    console.log("[ImageGen] Generating image for prompt:", prompt.slice(0, 80), "seed:", seed);

    const result = await env.AI.run(
      "@cf/black-forest-labs/flux-1-schnell",
      { prompt, num_steps: 4 }
    );

    // Workers AI FLUX returns an object with a base64-encoded JPEG `image` field
    let imageBytes: Uint8Array;
    if (result instanceof ReadableStream) {
      const reader = result.getReader();
      const chunks: Uint8Array[] = [];
      let len = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        len += value.length;
      }
      imageBytes = new Uint8Array(len);
      let offset = 0;
      for (const c of chunks) { imageBytes.set(c, offset); offset += c.length; }
    } else if (result && typeof result === "object" && "image" in (result as Record<string, unknown>)) {
      // Base64-encoded image string
      const b64 = (result as Record<string, unknown>).image as string;
      const binary = atob(b64);
      imageBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        imageBytes[i] = binary.charCodeAt(i);
      }
    } else {
      throw new Error("Unexpected AI response format");
    }

    console.log("[ImageGen] Image size:", imageBytes.length, "bytes");

    const response = new Response(imageBytes, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });

    return response;
  } catch (error) {
    console.error("[ImageGen] Error:", error);
    // Redirect to default fallback image
    return new Response(null, {
      status: 302,
      headers: { ...CORS_HEADERS, Location: "/news-images/default.jpg" },
    });
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Image generation endpoint — no auth (used in <img> tags)
    if (url.pathname === "/api/image" && request.method === "GET") {
      return handleImageGeneration(request, env, ctx);
    }

    // Auth: check API key
    const isUpgrade = request.headers.get("Upgrade") === "websocket";

    if (isUpgrade) {
      // WebSocket upgrades carry the key as a query param
      const apiKey = url.searchParams.get("apiKey");
      if (apiKey !== env.API_KEY) {
        return unauthorized();
      }
    } else {
      const apiKey = request.headers.get("X-API-Key");
      if (apiKey !== env.API_KEY) {
        return unauthorized();
      }
    }

    // Route to agents
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      // Don't add CORS to WebSocket upgrade responses
      if (agentResponse.status === 101) {
        return agentResponse;
      }
      return addCorsHeaders(agentResponse);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
