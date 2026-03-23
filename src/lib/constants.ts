export const CATEGORIES = [
  "Tech",
  "Business",
  "Sports",
  "Gaming",
  "Politics",
  "Science",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_QUERIES: Record<Category, string> = {
  Tech: "latest technology news today",
  Business: "latest business and finance news today",
  Sports: "latest sports news today",
  Gaming: "latest gaming and esports news today",
  Politics: "latest politics news today",
  Science: "latest science and research news today",
};

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
] as const;
