import { expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { runInNewContext } from "node:vm";
/* oxlint-enable import/no-nodejs-modules */

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

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
for (const runtime of ["nodejs", "edge"]) {
  for (const fail of [false, true]) {
    test(`core lifecycle survives optional instrumentation ${fail ? "failure" : "omission"} on ${runtime}`, async (): Promise<void> => {
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
            return {
              startLocalEveGuestCleanup: (): number => events.push("core"),
            };
          }
          throw new Error(`Unexpected import: ${name}`);
        },
      });
      if (!exports.register) {
        throw new Error("Missing register export");
      }
      await (fail
        ? // oxlint-disable-next-line typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
          expect(exports.register()).rejects.toBe(failure)
        : exports.register());
      expect(received).toEqual(fail ? [{ appPrefix: "test", runtime }] : []);
      expect(events).toEqual([
        ...(runtime === "nodejs" ? ["core"] : []),
        ...(fail ? ["optional"] : []),
      ]);
    });
  }
}
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */
