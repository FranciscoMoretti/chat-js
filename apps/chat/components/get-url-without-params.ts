/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getUrlWithoutParams); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const getUrlWithoutParams = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // If it's not a valid URL, just strip everything after ?
    return url.replace(/\?.*$/su, "");
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
