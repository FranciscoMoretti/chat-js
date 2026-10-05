export const getUrlWithoutParams = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // If it's not a valid URL, just strip everything after ?
    return url.replace(/\?.*$/su, "");
  }
};
