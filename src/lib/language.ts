/**
 * Language groups are automatic. The user types any language code; the app
 * keeps only the base part so `fr`, `fr-FR`, and `fr_CA` share one group.
 */
export function normalizeLanguageGroup(language: string) {
  const base = language.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return base || "en";
}

/**
 * Human name for a language code. Uses the browser/runtime language data, so a
 * new language needs no code change. Unknown codes fall back to the code.
 */
export function languageLabel(group: string) {
  const code = group.trim().toLowerCase();
  if (!code) return group;
  try {
    const display = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    if (display && display.trim() && display.toLowerCase() !== code) {
      return display;
    }
  } catch {
    // Older runtimes without Intl.DisplayNames use the code.
  }
  return code;
}

export function formatLanguageGroup(group: string) {
  return `${languageLabel(group)} (${group})`;
}

export type ChannelGroup<T> = {
  language_group: string;
  label: string;
  channels: T[];
};

/** Group channels by language, keeping the newest group order stable. */
export function groupChannelsByLanguage<T extends { language_group: string }>(
  channels: T[],
): ChannelGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const channel of channels) {
    const key = channel.language_group || normalizeLanguageGroup("en");
    const list = groups.get(key) ?? [];
    list.push(channel);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => languageLabel(left).localeCompare(languageLabel(right)))
    .map(([group, list]) => ({
      language_group: group,
      label: formatLanguageGroup(group),
      channels: list,
    }));
}
