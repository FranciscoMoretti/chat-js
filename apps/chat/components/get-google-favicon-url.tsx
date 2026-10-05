const defaultFaviconSizePx = 128;

/**
 * Gets a favicon URL via Google's favicon service for any URL/hostname.
 * @param urlOrHostname URL or hostname whose favicon is requested.
 * @param size Requested icon size in pixels.
 * @returns Service URL, or empty text when URL parsing fails.
 */
export const getGoogleFaviconUrl = (
  urlOrHostname: string,
  size = defaultFaviconSizePx
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
