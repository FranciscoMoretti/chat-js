/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers -- getGoogleFaviconUrl: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 128);  */
/**
 * Gets a favicon URL via Google's favicon service for any URL/hostname
 */
export const getGoogleFaviconUrl = (
  urlOrHostname: string,
  size = 128
): string => {
  try {
    const hostname = urlOrHostname.includes("://")
      ? new URL(urlOrHostname).hostname
      : urlOrHostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
  } catch {
    return "";
  }
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers */
