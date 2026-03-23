import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    const body = await request.json();
    const { newsArticleId, type, durationMs, voiceQuery } = body as {
      newsArticleId: string;
      type: "view" | "voice_query" | "skip" | "revisit";
      durationMs?: number;
      voiceQuery?: string;
    };

    if (!newsArticleId || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const interaction = await prisma.interaction.create({
      data: {
        userId,
        newsArticleId,
        type,
        durationMs,
        voiceQuery,
      },
    });

    return NextResponse.json({ interaction }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to record interaction" }, { status: 500 });
  }
}
