import { expect, test } from "bun:test";

/* oxlint-disable import/no-namespace -- This namespace exposes a generated or compiler API whose members are selected at the call site. */
import * as lucide from "lucide-react";
/* oxlint-enable import/no-namespace */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { composerIconNames } from "../composer-icons.generated";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("generated composer icon catalog matches Lucide exports, including aliases", () => {
  const components = new Set<unknown>(Object.values(lucide.icons));
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call -- Reflect the complete Lucide export catalog, including aliases, to verify generated icon names.
  const exportedNames = Object.entries(lucide)
    .filter(([, value]) => components.has(value))
    .map(([name]) => name)
    .toSorted();
  // oxlint-disable-next-line typescript/no-unsafe-argument -- Reflect the complete Lucide export catalog, including aliases, to verify generated icon names.
  expect([...composerIconNames]).toEqual(exportedNames);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
