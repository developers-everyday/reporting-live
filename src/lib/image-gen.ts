// Curated category images served from public/news-images/.
// The LLM tags each article with an imageTag during refinement.
// Falls back to default image if tag is unknown.

const IMAGE_TAGS = new Set([
  "war",
  "politics",
  "sports",
  "cricket",
  "football",
  "finance",
  "tech",
  "science",
  "health",
  "gaming",
  "climate",
  "world",
  "entertainment",
  "business",
]);

export function getNewsImageUrl(imageTag?: string): string {
  const tag = imageTag?.toLowerCase();
  if (tag && IMAGE_TAGS.has(tag)) {
    return `/news-images/${tag}.jpg`;
  }
  return `/news-images/default.jpg`;
}

export function generateNewsImages(
  articles: { headline: string; imageTag?: string }[],
): (string | null)[] {
  return articles.map((a) => getNewsImageUrl(a.imageTag));
}
