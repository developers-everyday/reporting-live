import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const articles = [
  {
    id: "openai-strawberry-reasoning",
    headline: "OpenAI announces new reasoning capabilities for Strawberry model",
    summary: "The new model showcases advanced multi-step reasoning, drastically reducing hallucination rates across complex logic challenges.",
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
    sourceUrls: ["https://bbc.com/news/tech", "https://reuters.com/tech"],
    sourceNames: ["BBC News", "Reuters"],
    categories: ["Tech", "Science"],
    topics: ["openai", "reasoning", "ai-models"],
    region: "Global",
  },
  {
    id: "spacex-starship-launch",
    headline: "SpaceX successfully launches Starship on highly anticipated test flight",
    summary: "The latest launch milestone brings humanity one step closer to making interplanetary travel a routine endeavor.",
    imageUrl: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=800&q=80",
    sourceUrls: ["https://space.com/starship", "https://nasa.gov", "https://apnews.com"],
    sourceNames: ["Space.com", "NASA", "AP"],
    categories: ["Tech", "Science"],
    topics: ["spacex", "starship", "space-exploration"],
    region: "Global",
  },
  {
    id: "global-stock-market-highs",
    headline: "Global stock markets reach record highs amidst tech rally",
    summary: "Investors are optimistic as technology giants continue to report massive earnings growth for the third consecutive quarter.",
    imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
    sourceUrls: ["https://bloomberg.com/markets", "https://ft.com/markets"],
    sourceNames: ["Bloomberg", "Financial Times"],
    categories: ["Business"],
    topics: ["stock-market", "tech-rally", "earnings"],
    region: "Global",
  },
];

async function seed() {
  console.log("Seeding articles...");
  const now = new Date().toISOString();

  for (const a of articles) {
    await sql.query(
      `INSERT INTO "NewsArticle" ("id", "headline", "summary", "imageUrl", "sourceUrls", "sourceNames", "categories", "topics", "region", "scrapedAt", "createdAt", "isActive")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, true)
       ON CONFLICT ("id") DO UPDATE SET "headline" = $2, "summary" = $3`,
      [a.id, a.headline, a.summary, a.imageUrl, a.sourceUrls, a.sourceNames, a.categories, a.topics, a.region, now]
    );
    console.log("Seeded:", a.id);
  }

  const count = await sql.query('SELECT count(*) FROM "NewsArticle"');
  console.log(`Total articles: ${count[0].count}`);
}

seed();
