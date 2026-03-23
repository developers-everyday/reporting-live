export const CATEGORIES = [
  "Tech",
  "Business",
  "Sports",
  "Gaming",
  "Politics",
  "Science",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
] as const;
