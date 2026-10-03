const URL_PATTERN = /^https?:\/\/(?<domain>[^/?#]+)(?:[/?#]|$)/iu;

/* oxlint-disable oxc/no-optional-chaining --
 * oxc/no-optional-chaining (#542): extractDomain handles optional URL_PATTERN.exec(url)?.groups?.domain without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
const extractDomain = (url: string): string =>
  URL_PATTERN.exec(url)?.groups?.domain ?? url;
/* oxlint-enable oxc/no-optional-chaining */

/* oxlint-disable id-length, import/no-named-export, import/prefer-default-export, typescript/prefer-readonly-parameter-types --
 * id-length (#506): deduplicateByDomainAndUrl uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/no-named-export (#527): Preserve the named deduplicateByDomainAndUrl API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): deduplicateByDomainAndUrl remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
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
/* oxlint-enable id-length, import/no-named-export, import/prefer-default-export, typescript/prefer-readonly-parameter-types */
