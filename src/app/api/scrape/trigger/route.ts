import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runScrapePipeline } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await getAuthUserId();

    const { searchParams } = new URL(request.url);
    if (searchParams.get("clean") === "true") {
      await prisma.$executeRaw`DELETE FROM "NewsArticle" WHERE 1=1`;
      console.log("[Scraper] Cleaned all existing articles");
    }

    const result = await runScrapePipeline();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Manual scrape trigger failed:", error);
    return NextResponse.json(
      { error: "Failed to trigger scrape" },
      { status: 500 }
    );
  }
}
