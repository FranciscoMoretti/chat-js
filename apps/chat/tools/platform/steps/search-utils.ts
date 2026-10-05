const URL_PATTERN = /^https?:\/\/(?<domain>[^/?#]+)(?:[/?#]|$)/iu;

const extractDomain = (url: string): string =>
  URL_PATTERN.exec(url)?.groups?.domain ?? url;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deduplicateByDomainAndUrl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types --
 * id-length (#506): deduplicateByDomainAndUrl uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/prefer-readonly-parameter-types (#565): deduplicateByDomainAndUrl accepts items: T[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const deduplicateByDomainAndUrl = <T extends { url: string }>(
  items: T[]
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
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */
