import { expect, test } from "bun:test";
import { parseEveCatalog, eveCompositionIssue } from "../eve-catalog";
import { installationSelectionSchema } from "../installation";
import { decodeAppPreset, encodeAppPreset } from "../app-preset";

test("native catalog preserves categories, setup requirements and future categories without per-item manifests", () => {
  const items = parseEveCatalog({
    items: [
      {
        name: "connection/new-service",
        title: "New service",
        meta: {
          eve: {
            setup: { bin: "eve" },
            requires: ">=1.0",
            docs: "/docs/connections/new-service",
          },
        },
        envVars: { SERVICE_KEY: "" },
      },
      { name: "future/new-capability" },
      { name: "channel/internal", meta: { eve: { hidden: true } } },
    ],
  });
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({
    id: "connection/new-service",
    category: "connection",
    setup: true,
    environment: ["SERVICE_KEY"],
    requires: ">=1.0",
    docs: "https://eve.dev/docs/connections/new-service",
  });
  expect(items[1]?.category).toBe("future");
  expect(eveCompositionIssue("channel/slack")).toBeUndefined();
  expect(eveCompositionIssue("channel/web")).toContain("separate frontend");
});

test("native selections survive export, deduplicate and reject unsafe installer arguments", () => {
  const selection = installationSelectionSchema.parse({
    eve: ["connection/linear", "tool/web_fetch", "connection/linear"],
  });
  expect(decodeAppPreset(encodeAppPreset(selection)).eve).toEqual([
    "connection/linear",
    "tool/web_fetch",
  ]);
  for (const id of [
    "--overwrite",
    "https://user:secret@registry.example/item",
    "tool/../../escape",
    "tool/x;echo",
  ]) {
    expect(() => installationSelectionSchema.parse({ eve: [id] })).toThrow();
  }
});

test("registry selections preserve native addresses, mappings and independent sources", () => {
  const selection = installationSelectionSchema.parse({
    eve: [
      "@skills/vercel-labs/agent-skills/vercel-react-best-practices",
      "@chatjs/deep-research",
      "@acme/search",
      "https://registry.example/item.json?q=a&limit=1",
    ],
    eveRegistries: { "@acme": "https://registry.example/r/{name}.json" },
  });
  expect(decodeAppPreset(encodeAppPreset(selection))).toEqual(selection);
  expect(() =>
    installationSelectionSchema.parse({ eve: ["@acme/search"] })
  ).toThrow("Configure @acme");
  expect(() =>
    installationSelectionSchema.parse({
      eveRegistries: { "@chatjs": "https://registry.example/{name}" },
    })
  ).toThrow();
});
