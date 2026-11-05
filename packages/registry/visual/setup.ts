import { commands } from "vitest/browser";

import { ensureFonts } from "../src/tools/_shared/visual-fonts";

declare module "vitest/browser" {
  interface BrowserCommands {
    faviconAssets: () => Promise<void>;
    modelAssets: () => Promise<void>;
  }
}

// Core app browser fixtures also need the fonts that next/font loads in the app.
// Reuse the registry's embedded font assets so archived captures remain portable.
await ensureFonts();
// A route outlives the file that installs it (files share one browser page), so
// serve the fixed favicon and model logo to every file, not only the ones that ask.
await commands.faviconAssets();
await commands.modelAssets();
