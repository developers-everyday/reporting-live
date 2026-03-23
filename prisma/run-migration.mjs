import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const migration = `
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "location" TEXT,
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL DEFAULT 'onboarding',
    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InterestScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterestScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NewsArticle" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fullContent" TEXT,
    "imageUrl" TEXT,
    "sourceUrls" TEXT[],
    "sourceNames" TEXT[],
    "categories" TEXT[],
    "topics" TEXT[],
    "region" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Interaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newsArticleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "durationMs" INTEGER,
    "voiceQuery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messages" JSONB NOT NULL,
    "extractedTopics" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScrapeJob" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "UserPreference_userId_idx" ON "UserPreference"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_userId_category_key" ON "UserPreference"("userId", "category");
CREATE INDEX IF NOT EXISTS "InterestScore_userId_score_idx" ON "InterestScore"("userId", "score" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "InterestScore_userId_topic_key" ON "InterestScore"("userId", "topic");
CREATE INDEX IF NOT EXISTS "NewsArticle_isActive_createdAt_idx" ON "NewsArticle"("isActive", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Interaction_userId_createdAt_idx" ON "Interaction"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Interaction_newsArticleId_idx" ON "Interaction"("newsArticleId");
CREATE INDEX IF NOT EXISTS "ConversationLog_userId_createdAt_idx" ON "ConversationLog"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ScrapeJob_status_createdAt_idx" ON "ScrapeJob"("status", "createdAt" DESC);

ALTER TABLE "UserPreference" DROP CONSTRAINT IF EXISTS "UserPreference_userId_fkey";
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterestScore" DROP CONSTRAINT IF EXISTS "InterestScore_userId_fkey";
ALTER TABLE "InterestScore" ADD CONSTRAINT "InterestScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_userId_fkey";
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_newsArticleId_fkey";
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_newsArticleId_fkey" FOREIGN KEY ("newsArticleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationLog" DROP CONSTRAINT IF EXISTS "ConversationLog_userId_fkey";
ALTER TABLE "ConversationLog" ADD CONSTRAINT "ConversationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;

async function run() {
  console.log("Running migration via Neon HTTP...");
  // Execute each statement separately
  const statements = migration
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await sql.query(stmt);
      console.log("OK:", stmt.slice(0, 60) + "...");
    } catch (e) {
      console.error("FAILED:", stmt.slice(0, 60), e.message);
    }
  }
  console.log("Migration complete!");
}

run();
