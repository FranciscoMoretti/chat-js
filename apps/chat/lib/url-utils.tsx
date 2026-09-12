export const getDomainFromUrl = (url: string) =>
  new URL(url).hostname.replace("www.", "");
export const getFaviconUrl = (result: {
  title: string;
  source: "web" | "academic" | "x";
  url: string;
  content: string;
  tweetId?: string | undefined;
}) =>
  `https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=128`;
