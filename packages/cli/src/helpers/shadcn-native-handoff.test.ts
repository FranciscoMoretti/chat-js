import { expect, test } from "bun:test";
import { rejects } from "node:assert/strict";
import { initializeShadcn } from "./initialize-shadcn";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Invalid presets must retain the native diagnostic and create no files.
// Full scaffold handoff is exercised by test:native-create.
test("native shadcn retains ordered options and its own invalid-preset diagnostic", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-native-handoff-"));
  try {
    await rejects(
      initializeShadcn(root, [
        "--preset",
        "first-invalid-preset",
        "--base=radix",
        "--no-rtl",
        "--pointer",
        "--preset",
        "last-invalid-preset",
      ]),
      /shadcn init failed.*\n[^]*Invalid preset: last-invalid-preset/u
    );
    expect(await readdir(root)).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
