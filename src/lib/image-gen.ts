// Primary: Pollinations AI generates unique images per article headline.
// Fallback: curated category images from public/news-images/ (derived on frontend).

const POLLINATIONS_BASE = "https://gen.pollinations.ai/image";

// Stable seed from headline so the same article always gets the same image
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generatePollinationsUrl(headline: string, category: string): string {
  const prompt = `News editorial photo: ${headline}. Category: ${category}. Photojournalistic, high quality, no text or watermarks.`;
  const encoded = encodeURIComponent(prompt);
  return `${POLLINATIONS_BASE}/${encoded}?width=1792&height=1024&model=flux&nologo=true&seed=${hashCode(headline)}`;
}

export function generateNewsImages(
  articles: { headline: string }[],
  category: string,
): string[] {
  return articles.map((a) => generatePollinationsUrl(a.headline, category));
}
