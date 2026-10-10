const getDomainFromUrl = (url: string): string =>
  new URL(url).hostname.replace("www.", "");

const getFaviconUrl = (result: {
  readonly title: string;
  readonly source: "web" | "academic" | "x";
  readonly url: string;
  readonly content: string;
  readonly tweetId?: string | undefined;
}): string =>
  `https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=128`;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getDomainFromUrl, getFaviconUrl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export { getDomainFromUrl, getFaviconUrl };
/* oxlint-enable import/no-named-export */
