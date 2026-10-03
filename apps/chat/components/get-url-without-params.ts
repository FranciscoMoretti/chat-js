/* oxlint-disable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary -- getUrlWithoutParams: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including qIndex === -1 ? url : url.slice(0, qIndex)). */
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary */
