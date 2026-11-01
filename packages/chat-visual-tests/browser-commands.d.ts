import "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    faviconAssets: () => Promise<void>;
    modelAssets: () => Promise<void>;
    appIcon: () => Promise<void>;
  }
}
