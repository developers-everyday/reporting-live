import { NextRequest, NextResponse } from "next/server";

const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL || "http://localhost:8787";

export async function GET(request: NextRequest) {
  const prompt = request.nextUrl.searchParams.get("prompt");
  const seed = request.nextUrl.searchParams.get("seed");

  if (!prompt) {
    return NextResponse.redirect(new URL("/news-images/default.jpg", request.url));
  }

  try {
    const params = new URLSearchParams({ prompt });
    if (seed) params.set("seed", seed);

    const response = await fetch(`${AGENTS_URL}/api/image?${params}`, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Worker returned ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("[Image Proxy] Error:", error);
    return NextResponse.redirect(new URL("/news-images/default.jpg", request.url));
  }
}
