/** YouTube category IDs accepted by Buffer's youtube metadata input. */
export const YOUTUBE_CATEGORIES = [
  { id: "1", name: "Film & Animation" },
  { id: "2", name: "Autos & Vehicles" },
  { id: "10", name: "Music" },
  { id: "15", name: "Pets & Animals" },
  { id: "17", name: "Sports" },
  { id: "19", name: "Travel & Events" },
  { id: "20", name: "Gaming" },
  { id: "22", name: "People & Blogs" },
  { id: "23", name: "Comedy" },
  { id: "24", name: "Entertainment" },
  { id: "25", name: "News & Politics" },
  { id: "26", name: "Howto & Style" },
  { id: "27", name: "Education" },
  { id: "28", name: "Science & Technology" },
  { id: "29", name: "Nonprofits & Activism" },
] as const;

export const DEFAULT_YOUTUBE_CATEGORY_ID = "22";

export function youtubeCategoryName(id: string | null | undefined) {
  return (
    YOUTUBE_CATEGORIES.find((category) => category.id === id)?.name ?? "Default"
  );
}

export function serviceLabel(service: string) {
  const map: Record<string, string> = {
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    twitter: "X",
    threads: "Threads",
    bluesky: "Bluesky",
    mastodon: "Mastodon",
    pinterest: "Pinterest",
    google: "Google Business",
    substack: "Substack",
  };
  return map[service] ?? service;
}
