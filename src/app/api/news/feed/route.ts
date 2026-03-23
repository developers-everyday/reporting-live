import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await getAuthUserId();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          headline: true,
          summary: true,
          imageUrl: true,
          sourceNames: true,
          categories: true,
          region: true,
          createdAt: true,
        },
      }),
      prisma.newsArticle.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      articles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
