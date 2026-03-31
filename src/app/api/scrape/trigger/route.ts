import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runScrapePipeline } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCRAPE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(request: Request) {
  try {
    await getAuthUserId();

    const { searchParams } = new URL(request.url);

    // Clean mode: wipe all articles (dev use only)
    if (searchParams.get("clean") === "true") {
      await prisma.$executeRaw`DELETE FROM "NewsArticle" WHERE 1=1`;
      console.log("[Scraper] Cleaned all existing articles");
    }

    // Check if we scraped recently (skip if within cooldown, unless force=true)
    if (searchParams.get("force") !== "true") {
      const lastJob = await prisma.scrapeJob.findFirst({
        where: { status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      });

      if (lastJob?.completedAt) {
        const elapsed = Date.now() - lastJob.completedAt.getTime();
        if (elapsed < SCRAPE_COOLDOWN_MS) {
          const minutesLeft = Math.ceil((SCRAPE_COOLDOWN_MS - elapsed) / 60_000);
          return NextResponse.json({
            success: true,
            skipped: true,
            message: `Last scrape was ${Math.floor(elapsed / 60_000)}m ago. Next in ${minutesLeft}m.`,
          });
        }
      }
    }

    // Accept optional categories filter from POST body
    let categories: string[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.categories) && body.categories.length > 0) {
        categories = body.categories;
      }
    } catch {
      // No body or invalid JSON — scrape all categories
    }

    const result = await runScrapePipeline(categories);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Manual scrape trigger failed:", error);
    return NextResponse.json(
      { error: "Failed to trigger scrape" },
      { status: 500 }
    );
  }
}
