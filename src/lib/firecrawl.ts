export interface FirecrawlNewsItem {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
}

// Raw response item may have various field names
interface RawSearchItem {
  title?: string;
  description?: string;
  snippet?: string;
  url?: string;
  date?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data: RawSearchItem[] | { news?: RawSearchItem[] };
}

// --- Scrape: fetch full article content as markdown ---

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: { markdown?: string };
}

export async function scrapeUrl(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[Firecrawl] FIRECRAWL_API_KEY is not set");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Firecrawl] Scrape failed (${res.status}):`, body);
      return null;
    }

    const json: FirecrawlScrapeResponse = await res.json();
    if (!json.success || !json.data?.markdown) {
      console.warn("[Firecrawl] Scrape returned no markdown for:", url);
      return null;
    }

    console.log(`[Firecrawl] Scraped ${url} (${json.data.markdown.length} chars)`);
    return json.data.markdown;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.error("[Firecrawl] Scrape timed out for:", url);
    } else {
      console.error("[Firecrawl] Scrape error:", error);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Search + Scrape combo: find related articles and scrape them ---

function extractSourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export async function searchAndScrape(
  query: string,
  excludeUrls: string[],
  limit = 5
): Promise<Array<{ url: string; sourceName: string; markdown: string }>> {
  const items = await searchNews(query, { limit });
  const excludeSet = new Set(excludeUrls);
  const candidates = items.filter((item) => !excludeSet.has(item.url)).slice(0, 3);

  if (candidates.length === 0) return [];

  const results = await Promise.allSettled(
    candidates.map(async (item) => {
      const markdown = await scrapeUrl(item.url);
      if (!markdown) throw new Error("Scrape failed");
      return { url: item.url, sourceName: extractSourceName(item.url), markdown };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ url: string; sourceName: string; markdown: string }> => r.status === "fulfilled")
    .map((r) => r.value);
}

// --- Search: news discovery ---

export async function searchNews(
  query: string,
  options?: { limit?: number; country?: string }
): Promise<FirecrawlNewsItem[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[Firecrawl] FIRECRAWL_API_KEY is not set");
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        tbs: "qdr:d",
        limit: options?.limit ?? 5,
        country: options?.country ?? "US",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Firecrawl] Search failed (${res.status}):`, body);
      return [];
    }

    const json: FirecrawlSearchResponse = await res.json();

    if (!json.success || !json.data) {
      console.error("[Firecrawl] Unexpected response:", json);
      return [];
    }

    // Handle both response shapes: flat array or { news: [...] }
    const rawItems = Array.isArray(json.data)
      ? json.data
      : json.data.news ?? [];

    // Log first item to debug field names and image availability
    if (rawItems.length > 0) {
      console.log(`[Firecrawl] "${query}" sample keys:`, Object.keys(rawItems[0]));
      console.log(`[Firecrawl] "${query}" sample item:`, JSON.stringify(rawItems[0], null, 2));
    }

    // Normalize and filter results
    const items: FirecrawlNewsItem[] = [];
    for (const raw of rawItems) {
      const title = raw.title?.trim() || "";
      const description = (raw.description || raw.snippet || "").trim();
      const url = raw.url || "";

      // Skip junk: no title, too short, generic, or video results
      if (!title || title.length < 10) continue;
      if (!url) continue;
      if (/^(latest news|video\.|breaking news)$/i.test(title)) continue;
      // Skip if description is empty or same as title
      if (!description || description === title) continue;

      const imageUrl = (raw.imageUrl || "").trim() || undefined;
      items.push({ title, description, url, imageUrl });
    }

    console.log(`[Firecrawl] "${query}" returned ${rawItems.length} raw, ${items.length} after filtering`);
    return items;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.error("[Firecrawl] Search timed out for query:", query);
    } else {
      console.error("[Firecrawl] Search error:", error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
