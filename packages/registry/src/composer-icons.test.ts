import { expect, test } from "bun:test";

/* oxlint-disable import/no-namespace -- Inspect every named Lucide export, including aliases outside lucide.icons, to verify the complete generated catalog. */
import * as lucide from "lucide-react";
/* oxlint-enable import/no-namespace */

/* oxlint-disable import/no-relative-parent-imports -- Import the package-local generated catalog, schema, or demo installer directly; application aliases do not identify these registry package modules. */
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
