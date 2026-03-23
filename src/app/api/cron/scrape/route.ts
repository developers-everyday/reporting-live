import { NextResponse } from "next/server";
import { runScrapePipeline } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScrapePipeline();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Cron scrape failed:", error);
    return NextResponse.json(
      { error: "Scrape pipeline failed" },
      { status: 500 }
    );
  }
}
