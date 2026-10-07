const defaultFaviconSizePx = 128;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getGoogleFaviconUrl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/**
 * Gets a favicon URL via Google's favicon service for any URL/hostname.
 * @param {string} urlOrHostname URL or hostname whose favicon is requested.
 * @param {number} size Requested icon size in pixels.
 * @returns {string} Service URL, or empty text when URL parsing fails.
 */
export const getGoogleFaviconUrl = (
  urlOrHostname: string,
  size = defaultFaviconSizePx
): string => {
  try {
    // oxlint-disable-next-line no-ternary -- Keep hostname as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const hostname = urlOrHostname.includes("://")
      ? new URL(urlOrHostname).hostname
      : urlOrHostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
  } catch {
    return "";
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
