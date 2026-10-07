import { loadFont } from "@remotion/fonts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { Img, staticFile } from "remotion";
/* oxlint-enable sort-imports */

void loadFont({
  family: "Geist",
  url: staticFile("brand/geist-latin.woff2"),
  weight: "100 900",
});
void loadFont({
  family: "Geist Mono",
  url: staticFile("brand/geist-mono-latin.woff2"),
  weight: "100 900",
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Logo); the enabled import/no-default-export convention rejects the default-export alternative. */
export const Logo = (): React.JSX.Element => (
  <Img src={staticFile("brand/chatjs-logo.svg")} alt="ChatJS" />
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
