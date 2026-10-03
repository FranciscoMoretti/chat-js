/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): getDomainFromUrl stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getDomainFromUrl API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const getDomainFromUrl = (url: string): string =>
  new URL(url).hostname.replace("www.", "");
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): getFaviconUrl stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getFaviconUrl API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): getFaviconUrl accepts result: { title: string; source: "web" | "academic" | "x"; url: string; content: stri; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const getFaviconUrl = (result: {
  title: string;
  source: "web" | "academic" | "x";
  url: string;
  content: string;
  tweetId?: string | undefined;
}): string =>
  `https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=128`;
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */
