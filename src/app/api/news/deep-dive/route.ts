import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/firecrawl";
import { generateDeepDive } from "@/lib/llm";

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
        summary: true,
        sourceUrls: true,
        deepDiveSummary: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Return cached deep dive if available
    if (article.deepDiveSummary) {
      return NextResponse.json({ success: true, briefing: article.deepDiveSummary, cached: true });
    }

    // Scrape the source article via Firecrawl
    const sourceUrl = article.sourceUrls[0];
    if (!sourceUrl) {
      return NextResponse.json({ success: false, briefing: "No source URL available for this article." });
    }

    const markdown = await scrapeUrl(sourceUrl);
    if (!markdown) {
      return NextResponse.json({ success: false, briefing: "I couldn't access the full article from the source right now." });
    }

    // Generate detailed briefing via LLM
    const briefing = await generateDeepDive(article.headline, article.summary, markdown);

    // Cache in DB
    await prisma.newsArticle.update({
      where: { id: articleId },
      data: { fullContent: markdown, deepDiveSummary: briefing },
    });

    // Record interaction
    await prisma.interaction.create({
      data: { userId, newsArticleId: articleId, type: "deep_dive" },
    });

    return NextResponse.json({ success: true, briefing, cached: false });
  } catch (error) {
    console.error("Deep dive failed:", error);
    return NextResponse.json(
      { success: false, briefing: "Something went wrong while fetching more details." },
      { status: 500 }
    );
  }
}
