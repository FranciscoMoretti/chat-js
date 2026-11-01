const URL_PATTERN = /^https?:\/\/(?<domain>[^/?#]+)(?:[/?#]|$)/iu;

const extractDomain = (url: string): string =>
  URL_PATTERN.exec(url)?.groups?.domain ?? url;

export const deduplicateByDomainAndUrl = <
  Item extends { readonly url: string },
>(
  items: readonly Item[]
): Item[] => {
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  return items.filter((item) => {
    const domain = extractDomain(item.url);
    const isNewUrl = !seenUrls.has(item.url);
    const isNewDomain = !seenDomains.has(domain);

    if (isNewUrl && isNewDomain) {
      seenUrls.add(item.url);
      seenDomains.add(domain);
      return true;
    }
    return false;
  });
};
