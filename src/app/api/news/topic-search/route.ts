import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";
import { searchNews } from "@/lib/firecrawl";
import { refineArticles } from "@/lib/llm";
import { generateNewsImages } from "@/lib/image-gen";

export const maxDuration = 60;

function extractSourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function extractTopics(headline: string, topic: string): string[] {
  const topics = new Set<string>([topic.toLowerCase()]);
  const entities = headline.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (entities) {
    for (const entity of entities) {
      if (entity.length > 2) topics.add(entity.toLowerCase());
    }
  }
  return Array.from(topics).slice(0, 5);
}

export async function POST(request: Request) {
  try {
    await getAuthUserId();

    const body = await request.json();
    const query = (body.query || "").trim();

    if (!query || query.length < 2 || query.length > 200) {
      return NextResponse.json(
        { error: "Query must be between 2 and 200 characters" },
        { status: 400 }
      );
    }

    // Search Firecrawl for the topic
    const searchQuery = `latest ${query} news today`;
    const items = await searchNews(searchQuery, { limit: 5 });

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        articles: [],
        message: "No articles found for this topic.",
      });
    }

    // Deduplicate against existing active articles
    const existingArticles = await prisma.newsArticle.findMany({
      where: { isActive: true },
      select: { sourceUrls: true },
    });
    const existingUrlSet = new Set(existingArticles.flatMap((a) => a.sourceUrls));
    const newItems = items.filter((item) => item.url && !existingUrlSet.has(item.url));

    if (newItems.length === 0) {
      // Return existing articles that match by searching the DB
      const existing = await prisma.newsArticle.findMany({
        where: {
          isActive: true,
          sourceUrls: { hasSome: items.map((i) => i.url) },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          headline: true,
          summary: true,
          imageUrl: true,
          sourceUrls: true,
          sourceNames: true,
          categories: true,
          region: true,
        },
      });
      return NextResponse.json({ success: true, articles: existing, cached: true });
    }

    // Refine via LLM
    const refined = await refineArticles(newItems, query);
    const images = generateNewsImages(refined);

    // Save to DB
    const savedArticles = [];
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const refinedItem = refined[i];
      try {
        const article = await prisma.newsArticle.create({
          data: {
            headline: refinedItem.headline,
            summary: refinedItem.summary,
            imageUrl: images[i] || null,
            fullContent: item.description,
            sourceUrls: [item.url],
            sourceNames: [extractSourceName(item.url)],
            categories: [query],
            topics: extractTopics(refinedItem.headline, query),
            region: "US",
            scrapedAt: new Date(),
            publishedAt: null,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            isActive: true,
          },
          select: {
            id: true,
            headline: true,
            summary: true,
            imageUrl: true,
            sourceUrls: true,
            sourceNames: true,
            categories: true,
            region: true,
          },
        });
        savedArticles.push(article);
      } catch (err) {
        console.error("[TopicSearch] Failed to save article:", err);
      }
    }

    console.log(`[TopicSearch] "${query}" → ${savedArticles.length} new articles`);
    return NextResponse.json({ success: true, articles: savedArticles });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
