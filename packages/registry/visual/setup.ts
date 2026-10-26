import { ensureFonts } from "../src/tools/_shared/visual-fonts";

// Core app browser fixtures also need the fonts that next/font loads in the app.
// Reuse the registry's embedded font assets so archived captures remain portable.
await ensureFonts();
