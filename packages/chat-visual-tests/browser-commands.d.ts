import "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    appIcon: () => Promise<void>;
  }
}
