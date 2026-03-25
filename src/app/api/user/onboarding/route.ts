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
    // Handle case where email already exists under a different Clerk user ID
    // (e.g. user deleted account and re-signed up)
    const email = clerkUser?.emailAddresses[0]?.emailAddress || "";
    const displayName = clerkUser?.firstName
      ? `${clerkUser.firstName}${clerkUser.lastName ? " " + clerkUser.lastName : ""}`
      : undefined;

    let user;
    try {
      user = await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email,
          displayName,
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
    } catch (e: unknown) {
      // Duplicate email — update the existing row to use the new Clerk user ID
      const code = typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : "";
      if (code === "P2002" || code === "23505") {
        user = await prisma.user.update({
          where: { email },
          data: {
            id: userId,
            displayName,
            language: language || "en",
            location: location || null,
            isOnboarded: true,
          },
        });
      } else {
        throw e;
      }
    }

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
