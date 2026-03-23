import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const body = await request.json();
    const { interests, language, location } = body as {
      interests: string[];
      language: string;
      location: string;
    };

    // Upsert user with onboarding data
    const user = await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: clerkUser?.emailAddresses[0]?.emailAddress || "",
        displayName:
          clerkUser?.firstName
            ? `${clerkUser.firstName}${clerkUser.lastName ? " " + clerkUser.lastName : ""}`
            : undefined,
        language: language || "en",
        location: location || null,
        isOnboarded: true,
      },
      update: {
        language: language || "en",
        location: location || null,
        isOnboarded: true,
      },
    });

    // Upsert preferences for each selected interest
    for (const category of interests) {
      await prisma.userPreference.upsert({
        where: { userId_category: { userId, category } },
        create: { userId, category, source: "onboarding" },
        update: { source: "onboarding", weight: 1.0 },
      });
    }

    // Remove preferences for categories not selected
    await prisma.userPreference.deleteMany({
      where: {
        userId,
        category: { notIn: interests },
        source: "onboarding",
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
