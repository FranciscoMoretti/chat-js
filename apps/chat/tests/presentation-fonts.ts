import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Standalone presentation fixtures have no Next layout to install next/font.
// Embed the same Geist files as the visual harness so offline captures keep real metrics.
const registryRequire = createRequire(
  path.resolve(process.cwd(), "../../packages/registry/package.json")
);
const fontDirectory = path.join(
  path.dirname(registryRequire.resolve("geist/font")),
  "fonts"
);
const font = (file: string): string =>
  readFileSync(path.join(fontDirectory, file)).toString("base64");
export const presentationFonts = `
@font-face { font-family: "Geist"; font-style: normal; font-weight: 100 900; font-display: block; src: url("data:font/woff2;base64,${font("geist-sans/Geist-Variable.woff2")}") format("woff2"); }
@font-face { font-family: "Geist Mono"; font-style: normal; font-weight: 100 900; font-display: block; src: url("data:font/woff2;base64,${font("geist-mono/GeistMono-Variable.woff2")}") format("woff2"); }
:root { --font-sans: "Geist"; --font-mono: "Geist Mono"; }
`;
