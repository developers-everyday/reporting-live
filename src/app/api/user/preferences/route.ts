import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getAuthUserId();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        language: true,
        location: true,
        customTopics: true,
        preferences: {
          select: { category: true, weight: true, source: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      language: user.language,
      location: user.location,
      customTopics: user.customTopics || [],
      interests: user.preferences.map((p) => p.category),
      preferences: user.preferences,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getAuthUserId();
    const body = await request.json();
    const { interests, language, location, customTopics } = body as {
      interests?: string[];
      language?: string;
      location?: string;
      customTopics?: string[];
    };

    // Update profile fields if provided
    const profileUpdate: Record<string, unknown> = {};
    if (language !== undefined) profileUpdate.language = language;
    if (location !== undefined) profileUpdate.location = location;
    if (customTopics !== undefined) profileUpdate.customTopics = customTopics;

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: profileUpdate,
      });
    }

    // Update interest preferences if provided
    if (interests) {
      for (const category of interests) {
        await prisma.userPreference.upsert({
          where: { userId_category: { userId, category } },
          create: { userId, category, source: "settings" },
          update: { weight: 1.0 },
        });
      }

      // Remove unchecked categories (only settings/onboarding source)
      await prisma.userPreference.deleteMany({
        where: {
          userId,
          category: { notIn: interests },
          source: { in: ["onboarding", "settings"] },
        },
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        language: true,
        location: true,
        customTopics: true,
        preferences: {
          select: { category: true, weight: true, source: true },
        },
      },
    });

    return NextResponse.json({
      language: updated?.language,
      location: updated?.location,
      customTopics: updated?.customTopics || [],
      interests: updated?.preferences.map((p) => p.category),
      preferences: updated?.preferences,
    });
  } catch {
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
