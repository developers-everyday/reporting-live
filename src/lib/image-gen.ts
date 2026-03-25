// Primary: Pollinations AI generates unique images per article headline.
// Fallback: curated category images from public/news-images/.

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

const POLLINATIONS_BASE = "https://gen.pollinations.ai/image";

// Stable seed from headline so the same article always gets the same image
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getDefaultImageUrl(imageTag?: string): string {
  const tag = imageTag?.toLowerCase();
  if (tag && IMAGE_TAGS.has(tag)) {
    return `/news-images/${tag}.jpg`;
  }
  return `/news-images/default.jpg`;
}

export function generatePollinationsUrl(headline: string, category: string): string {
  const prompt = `News editorial photo: ${headline}. Category: ${category}. Photojournalistic, high quality, no text or watermarks.`;
  const encoded = encodeURIComponent(prompt);
  return `${POLLINATIONS_BASE}/${encoded}?width=1792&height=1024&model=flux&nologo=true&seed=${hashCode(headline)}`;
}

export function generateNewsImages(
  articles: { headline: string; imageTag?: string }[],
  category: string,
): { imageUrl: string; fallbackImageUrl: string }[] {
  return articles.map((a) => ({
    imageUrl: generatePollinationsUrl(a.headline, category),
    fallbackImageUrl: getDefaultImageUrl(a.imageTag),
  }));
}
