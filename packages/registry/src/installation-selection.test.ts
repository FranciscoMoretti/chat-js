import { expect, test } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- Test the canonical registry selection schema; existing application aliases and ./r-only package exports do not expose this private package source. */
import { installationSelectionSchema } from "../installation";
/* oxlint-enable import/no-relative-parent-imports */

// JSON/preset is a public boundary: runtime presence flags must not be accepted.
test("selection accepts addresses and rejects unknown presence/config fields", () => {
  expect(installationSelectionSchema.parse({})).toEqual({
    features: [],
    tools: [],
  });
  expect(
    installationSelectionSchema.parse({
      features: ["@chatjs/mcp"],
      gateway: "https://example.com/gateway.json",
      storage: { source: "memory" },
      tools: ["word-count"],
    })
  ).toEqual({
    features: ["@chatjs/mcp"],
    gateway: "https://example.com/gateway.json",
    storage: { options: {}, source: "memory" },
    tools: ["word-count"],
  });
  expect(() => installationSelectionSchema.parse({ mcp: true })).toThrow();
  expect(() =>
    installationSelectionSchema.parse({ storage: { source: "" } })
  ).toThrow();
  expect(() => installationSelectionSchema.parse({ features: [""] })).toThrow();
  expect(() => installationSelectionSchema.parse({ gateway: "" })).toThrow();
  expect(() => installationSelectionSchema.parse({ tools: [""] })).toThrow();
  expect(() =>
    installationSelectionSchema.parse({
      storage: { enabled: true, source: "memory" },
    })
  ).toThrow();
});
