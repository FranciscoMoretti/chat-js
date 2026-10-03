/* oxlint-disable no-magic-numbers -- getUrlWithoutParams: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1);  */
export const getUrlWithoutParams = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // If it's not a valid URL, just strip everything after ?
    const qIndex = url.indexOf("?");
    return qIndex === -1 ? url : url.slice(0, qIndex);
  }
};
/* oxlint-enable no-magic-numbers */
