import type { LanguageModelMiddleware } from "ai";

// Fallbacks for package.json imports when a developer tool is disabled.
export const devToolsMiddleware = (): LanguageModelMiddleware | undefined =>
  undefined;
export const ReactQueryDevtools = (): null => null;
