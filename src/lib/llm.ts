import { AzureOpenAI } from "openai";

interface RawArticle {
  title: string;
  description: string;
}

interface RefinedArticle {
  headline: string;
  summary: string;
  imageTag: string;
}

function passthrough(articles: RawArticle[], category?: string): RefinedArticle[] {
  const tag = category?.toLowerCase() || "default";
  return articles.map((a) => ({
    headline: a.title,
    summary: a.description,
    imageTag: tag,
  }));
}

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI | null {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_DEPLOYMENT) {
    return null;
  }
  if (!client) {
    client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
    });
  }
  return client;
}

const IMAGE_TAG_LIST = "war, politics, sports, cricket, football, finance, tech, science, health, gaming, climate, world, entertainment, business";

const SYSTEM_PROMPT = `You are a professional news editor for a voice-based news briefing app.
Your job is to rewrite raw scraped news into polished, broadcast-ready content.

RULES:
- Headline: Clean, engaging, 5-15 words. Remove source names, pipes (|), dashes followed by outlet names, "..." truncations. Make it informative and complete.
- Summary: 2-3 sentences. Informative, engaging, and natural-sounding when read aloud by a voice agent. Avoid jargon. Do not start with "In a" or similar cliches. Vary sentence openings across articles.
- imageTag: Pick ONE word from this list that best matches the article's visual theme: ${IMAGE_TAG_LIST}. Choose the most specific match (e.g. "cricket" over "sports" for cricket news).
- Do NOT fabricate facts. Only use information present in the original title and description.
- Do NOT add opinions or editorial commentary.
- Return valid JSON and nothing else.`;

export async function refineArticles(
  articles: RawArticle[],
  category: string
): Promise<RefinedArticle[]> {
  if (articles.length === 0) return [];

  const azureClient = getClient();
  if (!azureClient) {
    console.warn("[LLM] Azure OpenAI not configured, using passthrough");
    return passthrough(articles, category);
  }

  const userPrompt = `Rewrite these ${category} news articles. Return a JSON object with an "articles" array containing exactly ${articles.length} objects, each with "headline", "summary", and "imageTag" fields, in the same order as the input.

Input articles:
${JSON.stringify(
  articles.map((a, i) => ({ index: i, title: a.title, description: a.description })),
  null,
  2
)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await azureClient.chat.completions.create(
      {
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn(`[LLM] Empty response for ${category}, using passthrough`);
      return passthrough(articles, category);
    }

    const parsed = JSON.parse(content) as { articles: RefinedArticle[] };
    if (!Array.isArray(parsed.articles) || parsed.articles.length !== articles.length) {
      console.warn(`[LLM] Response length mismatch for ${category}, using passthrough`);
      return passthrough(articles, category);
    }

    for (const item of parsed.articles) {
      if (typeof item.headline !== "string" || typeof item.summary !== "string") {
        console.warn(`[LLM] Invalid item in ${category} response, using passthrough`);
        return passthrough(articles, category);
      }
    }

    console.log(`[LLM] Refined ${parsed.articles.length} articles for ${category}`);
    return parsed.articles;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.warn(`[LLM] Timeout for ${category}, using passthrough`);
    } else {
      console.error(`[LLM] Error for ${category}:`, error);
    }
    return passthrough(articles, category);
  } finally {
    clearTimeout(timeout);
  }
}

// --- Deep Dive: full article → detailed spoken briefing ---

const DEEP_DIVE_PROMPT = `You are a professional news analyst creating an in-depth briefing for a voice-based news app.
Create a detailed 30-60 second spoken briefing (about 100-150 words) from the full article content.
Be informative, engaging, and natural-sounding.
Do NOT use headers, bullet points, or formatting — this will be read aloud.
Do NOT fabricate facts. Only use information present in the article.
Start directly with the content, no preamble like "Here's a deeper look".`;

export async function generateDeepDive(
  headline: string,
  summary: string,
  fullMarkdown: string
): Promise<string> {
  const azureClient = getClient();
  if (!azureClient) {
    // Fallback: clean first 500 chars of markdown
    return fullMarkdown.replace(/[#*\[\]()>|_~`]/g, "").slice(0, 500).trim();
  }

  const truncated = fullMarkdown.slice(0, 8000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await azureClient.chat.completions.create(
      {
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages: [
          { role: "system", content: DEEP_DIVE_PROMPT },
          { role: "user", content: `Headline: ${headline}\nCurrent summary: ${summary}\n\nFull article:\n${truncated}` },
        ],
        max_completion_tokens: 500,
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn("[LLM] Empty deep dive response");
      return fullMarkdown.replace(/[#*\[\]()>|_~`]/g, "").slice(0, 500).trim();
    }

    console.log(`[LLM] Deep dive generated (${content.length} chars)`);
    return content;
  } catch (error) {
    console.error("[LLM] Deep dive error:", error);
    return fullMarkdown.replace(/[#*\[\]()>|_~`]/g, "").slice(0, 500).trim();
  } finally {
    clearTimeout(timeout);
  }
}

// --- Multi-Source Comparison ---

const MULTI_SOURCE_PROMPT = `You are a professional news analyst comparing how different sources cover the same story.
Create a concise multi-perspective summary (about 100-150 words) suitable for reading aloud.
Mention each source by name and highlight what each emphasizes differently.
Be objective and balanced. Do NOT use headers, bullet points, or formatting.
Start directly with the comparison, no preamble.`;

export async function generateMultiSourceComparison(
  headline: string,
  sources: Array<{ sourceName: string; markdown: string }>
): Promise<string> {
  const azureClient = getClient();
  if (!azureClient) {
    return "Multiple sources covered this story but I couldn't generate a comparison right now.";
  }

  const sourceSummaries = sources
    .map((s) => `Source: ${s.sourceName}\n${s.markdown.slice(0, 4000)}`)
    .join("\n\n---\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await azureClient.chat.completions.create(
      {
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages: [
          { role: "system", content: MULTI_SOURCE_PROMPT },
          { role: "user", content: `Story headline: ${headline}\n\n${sourceSummaries}` },
        ],
        max_completion_tokens: 500,
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return "Multiple sources covered this story but I couldn't generate a comparison right now.";
    }

    console.log(`[LLM] Multi-source comparison generated (${content.length} chars)`);
    return content;
  } catch (error) {
    console.error("[LLM] Multi-source error:", error);
    return "Multiple sources covered this story but I couldn't generate a comparison right now.";
  } finally {
    clearTimeout(timeout);
  }
}
