import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Invalid presets must retain the native diagnostic and create no files.
// Full scaffold handoff is exercised by test:native-create.
test("native shadcn retains ordered options and its own invalid-preset diagnostic", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-native-handoff-"));
  try {
    const executable = createRequire(import.meta.url).resolve("shadcn");
    const child = Bun.spawn(
      [
        process.execPath,
        executable,
        "init",
        "--preset",
        "first-invalid-preset",
        "--base=radix",
        "--no-rtl",
        "--pointer",
        "--preset",
        "last-invalid-preset",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" }
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode).toBe(1);
    expect(stdout + stderr).toContain("Invalid preset: last-invalid-preset");
    expect(stdout + stderr).not.toContain(
      "Invalid preset: first-invalid-preset"
    );
    expect(await readdir(root)).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
