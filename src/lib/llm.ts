import { AzureOpenAI } from "openai";

interface RawArticle {
  title: string;
  description: string;
}

interface RefinedArticle {
  headline: string;
  summary: string;
}

function passthrough(articles: RawArticle[]): RefinedArticle[] {
  return articles.map((a) => ({
    headline: a.title,
    summary: a.description,
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

const SYSTEM_PROMPT = `You are a professional news editor for a voice-based news briefing app.
Your job is to rewrite raw scraped news into polished, broadcast-ready content.

RULES:
- Headline: Clean, engaging, 5-15 words. Remove source names, pipes (|), dashes followed by outlet names, "..." truncations. Make it informative and complete.
- Summary: 2-3 sentences. Informative, engaging, and natural-sounding when read aloud by a voice agent. Avoid jargon. Do not start with "In a" or similar cliches. Vary sentence openings across articles.
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
    return passthrough(articles);
  }

  const userPrompt = `Rewrite these ${category} news articles. Return a JSON object with an "articles" array containing exactly ${articles.length} objects, each with "headline" and "summary" fields, in the same order as the input.

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
      return passthrough(articles);
    }

    const parsed = JSON.parse(content) as { articles: RefinedArticle[] };
    if (!Array.isArray(parsed.articles) || parsed.articles.length !== articles.length) {
      console.warn(`[LLM] Response length mismatch for ${category}, using passthrough`);
      return passthrough(articles);
    }

    for (const item of parsed.articles) {
      if (typeof item.headline !== "string" || typeof item.summary !== "string") {
        console.warn(`[LLM] Invalid item in ${category} response, using passthrough`);
        return passthrough(articles);
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
    return passthrough(articles);
  } finally {
    clearTimeout(timeout);
  }
}
