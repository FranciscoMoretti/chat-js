// oxlint-disable-next-line typescript/triple-slash-reference -- Ambient font modules must follow this harness into each consuming TypeScript project without a runtime import of a declaration file.
/// <reference path="./visual-assets.d.ts" />

import geistMonoUrl from "geist-mono.woff2";
import geistSansUrl from "geist-sans.woff2";

// Read a served asset and inline it as a base64 `data:` URI. The archive replays
// on the UI Verify server long after this vitest run — and its dev server — has
// exited, so a `url(http://localhost:<port>/…)` reference resolves to nothing
// there (fonts render serif, media renders broken). A `data:` URI travels inside
// the archive, so replay always has the real bytes.
export const assetDataUri = async (
  url: string,
  mime: string
): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Visual harness asset ${url} returned ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return `data:${mime};base64,${btoa(binary)}`;
};

// The app renders in Geist (via next/font). next/font can't run here, so
// `--font-sans` would be undefined and text would fall back to a system font
// with different metrics — which throws off line-height and icon alignment.
// Load the real Geist woff2 and wire the same CSS variables the app uses.
let fontsReady: Promise<void> | undefined;

const loadFonts = async (): Promise<void> => {
  const [sansSrc, monoSrc] = await Promise.all([
    assetDataUri(geistSansUrl, "font/woff2"),
    assetDataUri(geistMonoUrl, "font/woff2"),
  ]);
  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "Geist";
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
      src: url("${sansSrc}") format("woff2");
    }
    @font-face {
      font-family: "Geist Mono";
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
      src: url("${monoSrc}") format("woff2");
    }
    :root {
      --font-sans: "Geist";
      --font-mono: "Geist Mono";
    }
  `;
  document.head.append(style);

  await Promise.all([
    document.fonts.load('16px "Geist"'),
    document.fonts.load('700 16px "Geist"'),
    document.fonts.load('16px "Geist Mono"'),
  ]);
  await document.fonts.ready;
  // Fail loudly rather than silently capturing a fallback font.
  if (
    !document.fonts.check('16px "Geist"') ||
    !document.fonts.check('16px "Geist Mono"')
  ) {
    throw new Error("Geist fonts did not load in the visual harness");
  }
};

export const ensureFonts = async (): Promise<void> => {
  fontsReady ??= loadFonts();
  await fontsReady;
};
