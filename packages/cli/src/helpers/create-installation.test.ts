import { spawnSync } from "node:child_process";
import { encodeAppPreset } from "../../../registry/app-preset";
import { expect, test } from "bun:test";
import {
  assertExclusiveInstallation,
  readCreateInstallation,
} from "./create-installation";
import { createCommand } from "../../../../apps/site/components/create-model";
import { DEFAULT_PRESET_CONFIG, encodePreset } from "shadcn/preset";
import { parseCreateFlags } from "./selection-options";

test("Create's command round trips full and empty selections into the CLI", () => {
  for (const plugins of [[], ["feedback", "projects", "guest-chat"]]) {
    const selection = {
      gateway: "vercel",
      plugins,
      tools: [],
      storage: { source: "memory", options: {} },
    };
    const command = createCommand(DEFAULT_PRESET_CONFIG, "base", selection);
    const encoded =
      /--app-preset (?<selection>agent1_[A-Za-z0-9_-]+) -- --preset/u.exec(
        command
      )?.groups?.selection;
    expect(encoded).toBeDefined();
    const decoded = readCreateInstallation({ appPreset: encoded ?? "" });
    expect({ ...decoded, plugins: decoded.plugins.toSorted() }).toEqual({
      ...selection,
      plugins: plugins.toSorted(),
    });
  }
});

test("complete selection rejects invalid or ambiguous inputs before scaffolding", () => {
  expect(() => readCreateInstallation({ appPreset: "not-json" })).toThrow(
    "Agent configuration"
  );
  expect(() =>
    readCreateInstallation({
      installation: '{"gateway":"vercel","plugins":["attachment-uploads"]}',
    })
  ).toThrow("persistent");
  expect(() => {
    assertExclusiveInstallation({
      installation: "{}",
      projects: false,
      yes: true,
    });
  }).toThrow("cannot be combined");
  expect(() => {
    assertExclusiveInstallation({
      installation: "{}",
      target: "demo",
      yes: true,
    });
  }).not.toThrow();
});

test("generated shell command preserves custom values as one argument", () => {
  const selection = {
    gateway: "vercel",
    plugins: [],
    tools: ["deep-research"],
    storage: {
      source: "s3",
      options: { bucket: "team's 日本語 $(echo should-not-run)" },
    },
  };
  const command = createCommand(DEFAULT_PRESET_CONFIG, "radix", selection);
  // Only tokenize the generated command; never execute the CLI.
  const result = spawnSync(
    "/bin/sh",
    ["-c", `set -- ${command}; printf '%s\\0' "$@"`],
    { encoding: "utf-8" }
  );
  expect(result.status).toBe(0);
  const args = result.stdout.split("\0");
  const code = args[args.indexOf("--app-preset") + 1];
  expect(readCreateInstallation({ appPreset: code ?? "" })).toEqual(selection);
  expect(args.slice(args.indexOf("--") + 1, -1)).toEqual([
    "--preset",
    encodePreset(DEFAULT_PRESET_CONFIG),
    "--base",
    "radix",
  ]);
});

test("flags and presets normalize registry addresses and reject whitespace-only values", () => {
  const selection = { gateway: " openrouter ", plugins: [], tools: [] };
  const flags = parseCreateFlags({ gateway: selection.gateway });
  expect(flags.gateway).toBe("openrouter");
  expect(
    readCreateInstallation({ appPreset: encodeAppPreset(selection) }).gateway
  ).toBe(flags.gateway);
  expect(() => parseCreateFlags({ gateway: " " })).toThrow("--gateway");
  expect(() => encodeAppPreset({ ...selection, gateway: " " })).toThrow();
});

test("storage flags decode to an object at the CLI boundary", () => {
  const options = { bucket: "uploads", port: 2121, nested: { enabled: true } };
  expect(
    parseCreateFlags({ storageConfig: JSON.stringify(options) }).storageConfig
  ).toEqual(options);
  for (const input of ["{", "[]", "null", '"uploads"']) {
    expect(() => parseCreateFlags({ storageConfig: input })).toThrow(
      "--storage-config"
    );
  }
});

test("flag errors identify nested fields and repeated item indexes", () => {
  expect(() =>
    parseCreateFlags({ agentConfig: '{"limits":{"sessionTimeoutMs":"bad"}}' })
  ).toThrow(/--agent-config[\s\S]*limits\.sessionTimeoutMs/u);
  expect(() => parseCreateFlags({ auth: ["github", "typo"] })).toThrow(
    /--auth[\s\S]*\[1\]/u
  );
});

test("compact presets enforce dependencies before scaffolding", () => {
  const code = encodeAppPreset({
    gateway: "vercel",
    plugins: ["attachment-uploads"],
    tools: [],
  });
  expect(() => readCreateInstallation({ appPreset: code })).toThrow(
    "persistent"
  );
  expect(() =>
    readCreateInstallation({
      appPreset: encodeAppPreset({ plugins: [], tools: [] }),
    })
  ).toThrow("gateway");
});

test("App presets and JSON have distinct mutually exclusive flags", () => {
  const selection = { gateway: "vercel", plugins: [], tools: [] };
  const installation = JSON.stringify(selection);
  expect(readCreateInstallation({ installation })).toEqual(selection);
  expect(() =>
    readCreateInstallation({ appPreset: "a1", installation })
  ).toThrow("cannot be combined");
  expect(() => readCreateInstallation({ appPreset: installation })).toThrow(
    "expects a compact code"
  );
  expect(() => readCreateInstallation({ installation: "a1" })).toThrow(
    "expects JSON"
  );
  expect(() =>
    readCreateInstallation({ installation, storageConfig: {} })
  ).toThrow("Include storage options");
  expect(() => {
    assertExclusiveInstallation({ appPreset: "a1", projects: true });
  }).toThrow("cannot be combined");
});

test("catalog flags and a builder preset replay the same provider, auth and live EVE choices", async () => {
  const { selectionCommand } = await import("./selection-options");
  const { createSelectionFromFlags } = await import("./create-menu");
  const args = [
    "--gateway",
    "openrouter",
    "--storage-provider",
    "s3",
    "--storage-config",
    '{"bucket":"uploads"}',
    "--auth",
    "google",
    "--auth",
    "vercel",
    "--eve-item",
    "extension/future-item",
    "--eve-item",
    "https://example.org/r/item.json",
    "--eve-item",
    "extension/future-item",
    "--disabled-default-tool",
    "tool/bash",
    "--plugin",
    "feedback",
  ];
  const options = selectionCommand("create")
    .parse(args, { from: "user" })
    .opts();
  const selection = await createSelectionFromFlags(
    "/unused",
    parseCreateFlags(options)
  );
  expect(selection.eve).toEqual([
    "extension/future-item",
    "https://example.org/r/item.json",
  ]);
  expect(selection.auth).toEqual(["google", "vercel"]);
  expect(selection.storage).toEqual({
    source: "s3",
    options: { bucket: "uploads" },
  });
  expect(selection.agent?.disabledDefaultTools).toEqual(["tool/bash"]);
  expect(
    readCreateInstallation({ appPreset: encodeAppPreset(selection) })
  ).toEqual(selection);
  expect(() => parseCreateFlags({ auth: ["typo"] })).toThrow("--auth");
  expect(() => parseCreateFlags({ eveItem: ["bad-id"] })).toThrow("--eve-item");
  expect(
    createSelectionFromFlags(
      "/unused",
      parseCreateFlags({ eveItem: ["@team/search"] })
    )
  ).rejects.toThrow("Configure @team");
  expect(() => parseCreateFlags({ agentConfig: "[]" })).toThrow(
    "--agent-config"
  );
});
