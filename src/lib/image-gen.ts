// Uses Lorem Picsum for free, reliable news card images.
// Seed is derived from headline so each article gets a consistent image.

export function generateNewsImageUrl(headline: string): string {
  const seed = hashString(headline);
  return `https://picsum.photos/seed/${seed}/800/450`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function generateNewsImages(
  articles: { headline: string }[],
): (string | null)[] {
  return articles.map((a) => generateNewsImageUrl(a.headline));
}
