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
