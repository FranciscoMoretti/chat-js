import { expect, test } from "bun:test";

import * as lucide from "lucide-react";

import { composerIconNames } from "../composer-icons.generated";

test("generated composer icon catalog matches Lucide exports, including aliases", () => {
  const components = new Set<unknown>(Object.values(lucide.icons));
  const exportedNames = Object.entries(lucide)
    .filter(([, value]) => components.has(value))
    .map(([name]) => name)
    .toSorted();
  expect([...composerIconNames]).toEqual(exportedNames);
});
