import { expect, test } from "bun:test";

import { builtInStorage } from "./catalog";

const registryRoot = new URL("../../", import.meta.url);

for (const item of builtInStorage) {
  for (const file of item.files) {
    test(`${item.name} has maintained installer source`, async () => {
      expect(
        await Bun.file(new URL(file.path, registryRoot)).exists(),
        `Register source for ${item.name} or explicitly exclude the new SDK provider from the installation catalog.`
      ).toBe(true);
    });
  }
}
