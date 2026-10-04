const getDomainFromUrl = (url: string): string =>
  new URL(url).hostname.replace("www.", "");

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): getFaviconUrl accepts result: { title: string; source: "web" | "academic" | "x"; url: string; content: stri; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getFaviconUrl = (result: {
  title: string;
  source: "web" | "academic" | "x";
  url: string;
  content: string;
  tweetId?: string | undefined;
}): string =>
  `https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=128`;
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { getDomainFromUrl, getFaviconUrl };
