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
    test(`core lifecycle survives optional instrumentation ${fail ? "failure" : "omission"} on ${runtime}`, async () => {
      const events: string[] = [];
      const received: unknown[] = [];
      const failure = new Error("Missing credentials for langfuse");
      const registrations = fail
        ? [
            (context: unknown) => {
              received.push(context);
              events.push("optional");
              throw failure;
            },
          ]
        : [];
      const exports: { register?: () => Promise<void> } = {};
      runInNewContext(compiled, {
        exports,
        process: { env: { NEXT_RUNTIME: runtime } },
        require: (name: string) => {
          if (name === "@/features/installed-instrumentation") {
            return { installedInstrumentation: registrations };
          }
          if (name === "@/lib/config") {
            return { config: { appPrefix: "test" } };
          }
          if (name === "./lib/eve/local-guest-cleanup-scheduler") {
            return { startLocalEveGuestCleanup: () => events.push("core") };
          }
          throw new Error(`Unexpected import: ${name}`);
        },
      });
      if (!exports.register) {
        throw new Error("Missing register export");
      }
      await (fail
        ? expect(exports.register()).rejects.toBe(failure)
        : exports.register());
      expect(received).toEqual(fail ? [{ appPrefix: "test", runtime }] : []);
      expect(events).toEqual([
        ...(runtime === "nodejs" ? ["core"] : []),
        ...(fail ? ["optional"] : []),
      ]);
    });
  }
}
