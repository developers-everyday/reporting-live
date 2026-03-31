import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // Fetch user's selected interests and custom topics
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        customTopics: true,
        preferences: { select: { category: true } },
      },
    });

    const interestCategories = user?.preferences.map((p) => p.category) ?? [];
    const customTopics = user?.customTopics ?? [];
    const allTerms = [...interestCategories, ...customTopics];

    // Build where clause: filter by user's interests/topics, or show all if none set
    let where: object;
    if (allTerms.length > 0) {
      const categoryTerms = [...new Set(allTerms.flatMap((t) => [t, t.toLowerCase()]))];
      const topicTerms = [...new Set(allTerms.map((t) => t.toLowerCase()))];
      where = {
        isActive: true,
        OR: [
          { categories: { hasSome: categoryTerms } },
          { topics: { hasSome: topicTerms } },
        ],
      };
    } else {
      where = { isActive: true };
    }

    const [articles, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          headline: true,
          summary: true,
          imageUrl: true,
          sourceUrls: true,
          sourceNames: true,
          categories: true,
          region: true,
          createdAt: true,
        },
      }),
      prisma.newsArticle.count({ where }),
    ]);

    return NextResponse.json({
      articles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
