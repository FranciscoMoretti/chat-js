import { expect, test } from "bun:test";

import { installationSelectionSchema } from "../installation";

// JSON/preset is a public boundary: runtime presence flags must not be accepted.
test("selection accepts addresses and rejects unknown presence/config fields", () => {
  expect(installationSelectionSchema.parse({})).toEqual({
    plugins: [],
    tools: [],
  });
  expect(
    installationSelectionSchema.parse({
      plugins: ["@chatjs/mcp"],
      gateway: "https://example.com/gateway.json",
      storage: { source: "memory" },
      tools: ["word-count"],
    })
  ).toEqual({
    plugins: ["@chatjs/mcp"],
    gateway: "https://example.com/gateway.json",
    storage: { options: {}, source: "memory" },
    tools: ["word-count"],
  });
  expect(() => installationSelectionSchema.parse({ mcp: true })).toThrow();
  expect(() =>
    installationSelectionSchema.parse({ storage: { source: "" } })
  ).toThrow();
  expect(() => installationSelectionSchema.parse({ plugins: [""] })).toThrow();
  expect(() => installationSelectionSchema.parse({ gateway: "" })).toThrow();
  expect(() => installationSelectionSchema.parse({ tools: [""] })).toThrow();
  expect(() =>
    installationSelectionSchema.parse({
      storage: { enabled: true, source: "memory" },
    })
  ).toThrow();
});
