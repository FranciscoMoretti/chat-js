import { expect, test } from "bun:test";
import {
  assertExclusiveInstallation,
  readCreateInstallation,
} from "./create-installation";
import { createCommand } from "../../../../apps/site/components/create-model";
import { DEFAULT_PRESET_CONFIG } from "shadcn/preset";

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
    const encoded = /--installation '(?<selection>.+)' -- --preset/u.exec(
      command
    )?.groups?.selection;
    expect(encoded).toBeDefined();
    expect(readCreateInstallation(encoded ?? "")).toEqual(selection);
  }
});

test("complete selection rejects invalid or ambiguous inputs before scaffolding", () => {
  expect(() => readCreateInstallation("not-json")).toThrow("JSON installation");
  expect(() =>
    readCreateInstallation(
      '{"gateway":"vercel","plugins":["attachment-uploads"]}'
    )
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
