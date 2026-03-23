export interface FirecrawlNewsItem {
  title: string;
  description: string;
  url: string;
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

    // Log first item to debug field names
    if (rawItems.length > 0) {
      console.log(`[Firecrawl] "${query}" sample keys:`, Object.keys(rawItems[0]));
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

      items.push({ title, description, url });
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
