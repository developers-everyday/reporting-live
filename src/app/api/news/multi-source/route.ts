import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchAndScrape } from "@/lib/firecrawl";
import { generateMultiSourceComparison } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    const { articleId } = await request.json();

    if (!articleId) {
      return NextResponse.json({ error: "articleId is required" }, { status: 400 });
    }

    const article = await prisma.newsArticle.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        headline: true,
        sourceUrls: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Search for same story from other sources and scrape them
    const sources = await searchAndScrape(article.headline, article.sourceUrls);

    if (sources.length === 0) {
      return NextResponse.json({
        success: false,
        comparison: "I couldn't find additional source coverage for this story right now.",
        sourcesUsed: [],
      });
    }

    // Generate multi-source comparison via LLM
    const comparison = await generateMultiSourceComparison(article.headline, sources);

    // Record interaction
    await prisma.interaction.create({
      data: { userId, newsArticleId: articleId, type: "multi_source" },
    });

    return NextResponse.json({
      success: true,
      comparison,
      sourcesUsed: sources.map((s) => s.sourceName),
    });
  } catch (error) {
    console.error("Multi-source comparison failed:", error);
    return NextResponse.json(
      { success: false, comparison: "Something went wrong while checking other sources.", sourcesUsed: [] },
      { status: 500 }
    );
  }
}
