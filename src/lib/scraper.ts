import { prisma } from "@/lib/prisma";
import { searchNews } from "@/lib/firecrawl";
import { refineArticles } from "@/lib/llm";
import { generateNewsImages } from "@/lib/image-gen";
import { CATEGORIES, CATEGORY_QUERIES, type Category } from "@/lib/constants";

interface ScrapeResult {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  newArticles: number;
  deactivatedArticles: number;
}

function extractSourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function extractTopics(headline: string, category: string): string[] {
  const topics = new Set<string>([category.toLowerCase()]);

  // Extract capitalized multi-word phrases (named entities)
  const entities = headline.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (entities) {
    for (const entity of entities) {
      if (entity.length > 2) {
        topics.add(entity.toLowerCase());
      }
    }
  }

  return Array.from(topics).slice(0, 5);
}

export async function runScrapePipeline(): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    totalJobs: CATEGORIES.length,
    completedJobs: 0,
    failedJobs: 0,
    newArticles: 0,
    deactivatedArticles: 0,
  };

  // Step 1: Deactivate articles older than 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const deactivated: number = await prisma.$executeRaw`
    UPDATE "NewsArticle"
    SET "isActive" = false
    WHERE "isActive" = true AND "createdAt" < ${cutoff}
  `;
  result.deactivatedArticles = deactivated;

  // Step 2: Collect existing source URLs for deduplication
  const existingArticles = await prisma.newsArticle.findMany({
    where: { isActive: true },
    select: { sourceUrls: true },
  });
  const existingUrlSet = new Set(existingArticles.flatMap((a) => a.sourceUrls));

  // Step 3: Scrape each category sequentially
  for (const category of CATEGORIES) {
    const query = CATEGORY_QUERIES[category as Category];

    const job = await prisma.scrapeJob.create({
      data: { category, query, status: "running" },
    });

    try {
      const items = await searchNews(query);

      // Filter duplicates first
      const newItems = items.filter(
        (item) => item.url && !existingUrlSet.has(item.url)
      );

      if (newItems.length === 0) {
        await prisma.scrapeJob.update({
          where: { id: job.id },
          data: { status: "completed", resultCount: 0, completedAt: new Date() },
        });
        result.completedJobs++;
        console.log(`[Scraper] ${category}: 0 new articles (all duplicates)`);
        continue;
      }

      // Refine via LLM (gracefully falls back to raw data if unavailable)
      const refined = await refineArticles(newItems, category);

      // Generate Pollinations image URLs with category fallbacks
      const images = generateNewsImages(refined, category);

      let categoryNewCount = 0;
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        const refinedItem = refined[i];

        try {
          await prisma.newsArticle.create({
            data: {
              headline: refinedItem.headline,
              summary: refinedItem.summary,
              imageUrl: images[i].imageUrl,
              fallbackImageUrl: images[i].fallbackImageUrl,
              fullContent: item.description, // preserve original raw description
              sourceUrls: [item.url],
              sourceNames: [extractSourceName(item.url)],
              categories: [category],
              topics: extractTopics(refinedItem.headline, category),
              region: "US",
              scrapedAt: new Date(),
              publishedAt: null,
              expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              isActive: true,
            },
          });

          existingUrlSet.add(item.url);
          categoryNewCount++;
        } catch (insertError) {
          console.error(`[Scraper] Failed to insert article "${item.title}":`, insertError);
        }
      }

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          resultCount: categoryNewCount,
          completedAt: new Date(),
        },
      });

      result.completedJobs++;
      result.newArticles += categoryNewCount;
      console.log(`[Scraper] ${category}: ${categoryNewCount} new articles`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "failed", error: message },
      });
      result.failedJobs++;
      console.error(`[Scraper] ${category} failed:`, message);
    }
  }

  console.log("[Scraper] Pipeline complete:", result);
  return result;
}
