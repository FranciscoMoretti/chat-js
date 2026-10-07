import { expect, test } from "bun:test";

/* oxlint-disable import/no-namespace -- Inspect every named Lucide export, including aliases outside lucide.icons, to verify the complete generated catalog. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import * as lucide from "lucide-react";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-namespace */

/* oxlint-disable import/no-relative-parent-imports -- Compare the canonical package-generated catalog; the @/ application alias and ./r-only package exports do not resolve this source module. */
import { composerIconNames } from "../composer-icons.generated";
/* oxlint-enable import/no-relative-parent-imports */

test("generated composer icon catalog matches Lucide exports, including aliases", () => {
  const components = new Set<unknown>(Object.values(lucide.icons));
  const exportedNames = Object.entries(lucide)
    .filter(([, value]: readonly [string, unknown]) => components.has(value))
    .map(([name]: readonly [string, unknown]) => name)
    .toSorted();
  expect([...composerIconNames]).toEqual(exportedNames);
});
