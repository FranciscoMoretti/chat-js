import * as lucide from "lucide-react";
import { expect, test } from "bun:test";
import { composerIconNames } from "../composer-icons.generated";

test("generated composer icon catalog matches Lucide exports, including aliases", () => {
  const components = new Set<unknown>(Object.values(lucide.icons));
  const exportedNames = Object.entries(lucide)
    .filter(([, value]: readonly [string, unknown]) => components.has(value))
    .map(([name]: readonly [string, unknown]) => name)
    .toSorted();
  expect([...composerIconNames]).toEqual(exportedNames);
});
