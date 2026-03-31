// Primary: Cloudflare Workers AI (FLUX model) generates unique images per article headline.
// Proxied through Next.js API route for same-origin loading.
// Fallback: curated category images from public/news-images/ (derived on frontend).

// Stable seed from headline so the same article always gets the same image
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateImageUrl(headline: string, category: string): string {
  const prompt = `News editorial photo: ${headline}. Category: ${category}. Photojournalistic, high quality, no text or watermarks.`;
  const params = new URLSearchParams({
    prompt,
    seed: String(hashCode(headline)),
  });
  return `/api/image?${params}`;
}

export function generateNewsImages(
  articles: { headline: string }[],
  category: string,
): string[] {
  return articles.map((a) => generateImageUrl(a.headline, category));
}
