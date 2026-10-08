const URL_PATTERN = /^https?:\/\/(?<domain>[^/?#]+)(?:[/?#]|$)/iu;

const extractDomain = (url: string): string =>
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading domain from URL_PATTERN.exec(...).groups; read groups from URL_PATTERN.exec(...); preserve one receiver evaluation, skipped accesses and the existing url fallback. The app guidance prefers optional chaining.
  URL_PATTERN.exec(url)?.groups?.domain ?? url;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deduplicateByDomainAndUrl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable id-length -- id-length (#506): deduplicateByDomainAndUrl uses T as local notation or callback/type parameters; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

export const deduplicateByDomainAndUrl = <T extends { readonly url: string }>(
  items: readonly T[]
): T[] => {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable id-length */
