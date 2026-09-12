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
