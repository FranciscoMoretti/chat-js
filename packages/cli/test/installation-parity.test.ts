import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readInstallationProject,
  compareInstallationProjects,
} from "./installation-parity";

const bytes = (source: string) => new TextEncoder().encode(source);

test("Next type generation does not change source parity or hide application declarations", async () => {
  const expected = new Map([
    ["application.d.ts", bytes("export type Value = string;")],
  ]);
  const generated = new Map([
    ...expected,
    ["next-env.d.ts", bytes('/// <reference types="next" />')],
    [".next/types/routes.d.ts", bytes("export {};")],
  ]);
  expect(await compareInstallationProjects(expected, generated)).toEqual([]);
  expect(await compareInstallationProjects(generated, expected)).toEqual([]);
  generated.delete("application.d.ts");
  generated.set("other.d.ts", bytes("export {}"));
  expect(await compareInstallationProjects(expected, generated)).toEqual([
    { file: "application.d.ts", kind: "missing" },
    { file: "other.d.ts", kind: "unexpected" },
  ]);
});

test("filesystem parity includes generated wiring and excludes installation bookkeeping", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-parity-wiring-"));
  try {
    await mkdir(path.join(directory, "chatjs/generated"), { recursive: true });
    await writeFile(
      path.join(directory, "chatjs/generated/installed-chat.ts"),
      "export const installedChat = [];\n"
    );
    await writeFile(path.join(directory, "chatjs/receipts.json"), "{}");
    const expected = new Map([
      [
        "chatjs/generated/installed-chat.ts",
        bytes("export const installedChat = [];\n"),
      ],
    ]);
    const actual = await readInstallationProject(directory);
    expect([...actual.keys()]).toEqual([...expected.keys()]);
    expect(await compareInstallationProjects(expected, actual)).toEqual([]);
    await rm(path.join(directory, "chatjs/generated/installed-chat.ts"));
    expect(
      await compareInstallationProjects(
        expected,
        await readInstallationProject(directory)
      )
    ).toEqual([
      { file: "chatjs/generated/installed-chat.ts", kind: "missing" },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
