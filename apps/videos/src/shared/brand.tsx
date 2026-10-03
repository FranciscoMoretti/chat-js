import { loadFont } from "@remotion/fonts";
/* oxlint-disable eslint/sort-imports -- the react import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import React from "react";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- the remotion import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { Img, staticFile } from "remotion";
/* oxlint-enable eslint/sort-imports */

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
/* oxlint-disable import/prefer-default-export -- Logo: Consumers use this named API so adding another export will not require changing existing imports. */
/* oxlint-disable import/no-named-export -- Logo: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export const Logo = (): React.JSX.Element => (
  <Img src={staticFile("brand/chatjs-logo.svg")} alt="ChatJS" />
);
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
