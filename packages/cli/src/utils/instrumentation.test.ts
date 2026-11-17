import { rejects } from "node:assert/strict";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

import ts from "typescript";

const source = await readFile(
  new URL("../../../../apps/chat/instrumentation.ts", import.meta.url),
  "utf-8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

for (const fail of [false, true]) {
  test(`all registrations start despite another instrumentation ${fail ? "failure" : "omission"}`, async (): Promise<void> => {
    const events: string[] = [];
    const failure = new Error("Startup registration failed");
    const registrations: (() => void)[] = fail
      ? [
          (): never => {
            events.push("optional");
            throw failure;
          },
        ]
      : [];
    registrations.push(() => {
      events.push("cleanup");
    });
    const exports: { register?: () => Promise<void> } = {};
    runInNewContext(compiled, {
      exports,
      require: (name: string) => {
        if (name === "@/integrations/instrumentation") {
          return { instrumentation: registrations };
        }
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    if (!exports.register) {
      throw new Error("Missing register export");
    }
    await (fail
      ? rejects(exports.register(), (reason: unknown) => reason === failure)
      : exports.register());
    expect(events).toEqual([...(fail ? ["optional"] : []), "cleanup"]);
  });
}
