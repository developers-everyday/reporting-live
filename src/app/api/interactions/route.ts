import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";

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

    // Ensure user exists in DB (may not if onboarding was skipped/failed)
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      const clerkUser = await currentUser();
      await prisma.user.create({
        data: {
          id: userId,
          email: clerkUser?.emailAddresses[0]?.emailAddress || "",
          displayName: clerkUser?.firstName
            ? `${clerkUser.firstName}${clerkUser.lastName ? " " + clerkUser.lastName : ""}`
            : undefined,
        },
      });
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
  } catch (error) {
    console.error("[Interactions] Error:", error);
    return NextResponse.json({ error: "Failed to record interaction" }, { status: 500 });
  }
}
