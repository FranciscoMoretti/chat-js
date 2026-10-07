import { expect, test } from "bun:test";

import { builtInStorage } from "./catalog";

const registryRoot = new URL("../../", import.meta.url);

for (const item of builtInStorage) {
  for (const file of item.files) {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
    test(`${item.name} has maintained installer source`, async () => {
      expect(
        await Bun.file(new URL(file.path, registryRoot)).exists(),
        `Register source for ${item.name} or explicitly exclude the new SDK provider from the installation catalog.`
      ).toBe(true);
    });
    /* oxlint-enable oxc/no-async-await */
  }
}
