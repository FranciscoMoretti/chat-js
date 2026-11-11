import { expect, test } from "bun:test";
import {
  encodeAppPreset,
  decodeAppPreset,
  encodeInstallationInput,
  readInstallationInput,
} from "../app-preset";
import { demoInstallation, installationSelectionSchema } from "../installation";
import { registry } from "../registry";
import { installationCatalog } from "../installation-catalog";
import vectors from "./app-preset-v1.json";

// Released wire-format vectors. Never regenerate these to accommodate a change:
// existing codes must retain their meaning. Append vectors for newly assigned IDs.
test("version-a historical codes preserve every built-in ID", () => {
  expect(encodeAppPreset({ plugins: [], tools: [] })).toBe("a0");
  expect(decodeAppPreset("a0")).toEqual({ plugins: [], tools: [] });
  for (const [kind, entries] of Object.entries(vectors)) {
    expect(Object.keys(entries).toSorted()).toEqual(
      installationCatalog(registry.items)
        .filter((item) => item.definition?.kind === kind)
        .flatMap((item) => (item.definition ? [item.definition.id] : []))
        .toSorted()
    );
    for (const [id, code] of Object.entries(entries)) {
      let fields: unknown;
      if (kind === "plugin") {
        fields = { plugins: [id] };
      } else if (kind === "tool") {
        fields = { tools: [id] };
      } else if (kind === "storage") {
        fields = { storage: { source: id } };
      } else {
        fields = { [kind]: id };
      }
      const selection = installationSelectionSchema.parse(fields);
      expect(encodeAppPreset(selection)).toBe(code);
      expect(decodeAppPreset(code)).toEqual(selection);
    }
  }
});

test("bit fields remain independent, deterministic, and precise beyond 53 bits", () => {
  const code = encodeAppPreset(demoInstallation);
  const decoded = decodeAppPreset(code);
  expect(decoded.plugins.toSorted()).toEqual(
    demoInstallation.plugins.toSorted()
  );
  expect(decoded.tools.toSorted()).toEqual(demoInstallation.tools.toSorted());
  expect(decoded.gateway).toBe(demoInstallation.gateway);
  expect(decoded.storage).toEqual(demoInstallation.storage);
  expect(decoded.sandbox).toBe(demoInstallation.sandbox);
  expect(
    encodeAppPreset({
      ...demoInstallation,
      plugins: demoInstallation.plugins.toReversed(),
      tools: demoInstallation.tools.toReversed(),
    })
  ).toBe(code);
  expect(encodeAppPreset(decoded)).toBe(code);
  expect(code.length).toBeLessThanOrEqual(15);
});

test("unsupported versions, provider IDs, feature bits, and overflow fail closed", () => {
  // 'aF' selects unassigned gateway 15.
  for (const code of [
    "",
    "a",
    "b0",
    "a00",
    "a!",
    "aF",
    "aZZZZZZZZZZZZZZ",
    "a0000000000000000",
  ]) {
    expect(() => decodeAppPreset(code)).toThrow();
  }
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  // Plugin bit 15, after the 16 provider bits.
  let unknownPlugin = 2n ** 31n;
  let digits = "";
  while (unknownPlugin > 0n) {
    digits = alphabet[Number(unknownPlugin % 62n)] + digits;
    unknownPlugin /= 62n;
  }
  expect(() => decodeAppPreset(`a${digits}`)).toThrow("unsupported features");
  expect(() => encodeAppPreset({ plugins: ["unknown"], tools: [] })).toThrow(
    "cannot encode"
  );
  expect(() =>
    encodeAppPreset({
      ...demoInstallation,
      storage: { source: "s3", options: { bucket: "files" } },
    })
  ).toThrow("--storage-config");
});

test("hybrid input preserves arbitrary values without embedding them in the code", () => {
  const selection = {
    ...demoInstallation,
    storage: {
      source: "s3",
      options: { bucket: "team's files – 日本語", region: "eu-west-2" },
    },
  };
  const { code, storageConfig } = encodeInstallationInput(selection);
  expect(code).toMatch(/^a[0-9A-Za-z]+$/u);
  expect(decodeAppPreset(code).storage?.options).toEqual({});
  expect(readInstallationInput(code, storageConfig).storage).toEqual(
    selection.storage
  );
  expect(readInstallationInput(JSON.stringify(selection))).toEqual(selection);
  expect(() => readInstallationInput(code, "[]")).toThrow();
  expect(() => readInstallationInput(code, "null")).toThrow();
  expect(() => readInstallationInput("a0", "{}")).toThrow("requires storage");
  expect(() => readInstallationInput(JSON.stringify(selection), "{}")).toThrow(
    "already contain"
  );
});
