import { expect, test } from "bun:test";
import { compareInstallationProjects } from "./installation-parity";

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
