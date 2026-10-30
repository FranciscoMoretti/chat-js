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

for (const runtime of ["nodejs", "edge"]) {
  for (const fail of [false, true]) {
    test(`all registrations start despite another instrumentation ${fail ? "failure" : "omission"} on ${runtime}`, async (): Promise<void> => {
      const events: string[] = [];
      const received: unknown[] = [];
      const failure = new Error("Missing credentials for langfuse");
      const registrations: ((context: unknown) => void)[] = fail
        ? [
            (context: unknown): never => {
              received.push(context);
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
        process: { env: { NEXT_RUNTIME: runtime } },
        require: (name: string) => {
          if (name === "@/integrations/instrumentation") {
            return { instrumentation: registrations };
          }
          if (name === "@/lib/config") {
            return { config: { appPrefix: "test" } };
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
      expect(received).toEqual(fail ? [{ appPrefix: "test", runtime }] : []);
      expect(events).toEqual([...(fail ? ["optional"] : []), "cleanup"]);
    });
  }
}
