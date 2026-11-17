import icons from "./capability-icons.json";

/** Stable registry IDs, never display-name matching. Assets are served locally. */
export const capabilityBrandIcon = (id: string): string | undefined => {
  const entries: Readonly<Record<string, string>> = icons;
  return Object.hasOwn(entries, id)
    ? `/capability-icons/${entries[id]}`
    : undefined;
};
