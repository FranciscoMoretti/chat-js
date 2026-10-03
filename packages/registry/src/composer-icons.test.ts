import { expect, test } from "bun:test";

import * as lucide from "lucide-react";

import { composerIconNames } from "../composer-icons.generated";

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
