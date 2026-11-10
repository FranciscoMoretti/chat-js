import { spawnSync } from "node:child_process";
import { encodeInstallationInput } from "../../../registry/app-preset";
import { expect, test } from "bun:test";
import {
  assertExclusiveInstallation,
  readCreateInstallation,
} from "./create-installation";
import { createCommand } from "../../../../apps/site/components/create-model";
import { DEFAULT_PRESET_CONFIG, encodePreset } from "shadcn/preset";

test("Create's command round trips full and empty selections into the CLI", () => {
  for (const plugins of [
    [],
    ["feedback", "projects", "langfuse", "guest-chat"],
  ]) {
    const selection = {
      gateway: "vercel",
      plugins,
      tools: [],
      storage: { source: "memory", options: {} },
    };
    const command = createCommand(DEFAULT_PRESET_CONFIG, "base", selection);
    const encoded =
      /--app-preset (?<selection>a[0-9A-Za-z]+) -- --preset/u.exec(command)
        ?.groups?.selection;
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
    "App preset"
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
    tools: ["word-count"],
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
  const config = args[args.indexOf("--storage-config") + 1];
  expect(
    readCreateInstallation({ appPreset: code ?? "", storageConfig: config })
  ).toEqual(selection);
  expect(args.slice(args.indexOf("--") + 1, -1)).toEqual([
    "--preset",
    encodePreset(DEFAULT_PRESET_CONFIG),
    "--base",
    "radix",
  ]);
  expect(() => readCreateInstallation({ appPreset: code ?? "" })).toThrow(
    "bucket"
  );
  expect(() =>
    readCreateInstallation({
      appPreset: code ?? "",
      storageConfig: '{"secretAccessKey":"secret"}',
    })
  ).toThrow();
  expect(() => {
    assertExclusiveInstallation({
      appPreset: code,
      storageConfig: config,
      yes: true,
    });
  }).not.toThrow();
});

test("compact presets enforce dependencies before scaffolding", () => {
  const { code } = encodeInstallationInput({
    gateway: "vercel",
    plugins: ["attachment-uploads"],
    tools: [],
  });
  expect(() => readCreateInstallation({ appPreset: code })).toThrow(
    "persistent"
  );
  expect(() => readCreateInstallation({ appPreset: "a0" })).toThrow("gateway");
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
    readCreateInstallation({ installation, storageConfig: "{}" })
  ).toThrow("already contain");
  expect(() => {
    assertExclusiveInstallation({ appPreset: "a1", projects: true });
  }).toThrow("cannot be combined");
});
