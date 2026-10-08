import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun test evaluates generated Node configuration with controlled native runtime bindings.
import { runInNewContext } from "node:vm";

import ts from "typescript";

// oxlint-disable-next-line node/no-top-level-await -- This Bun suite reads the instrumentation source before registering its source-contract assertions.
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
for (const runtime of ["nodejs", "edge"]) {
  for (const fail of [false, true]) {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
    // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    test(`core lifecycle survives optional instrumentation ${fail ? "failure" : "omission"} on ${runtime}`, async (): Promise<void> => {
      const events: string[] = [];
      const received: unknown[] = [];
      const failure = new Error("Missing credentials for langfuse");
      // oxlint-disable-next-line no-ternary -- Keep registrations as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      const registrations = fail
        ? [
            (context: unknown): never => {
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
      // oxlint-disable-next-line no-ternary -- Keep awaited branch as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      await (fail
        ? // oxlint-disable-next-line typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
          expect(exports.register()).rejects.toBe(failure)
        : exports.register());
      // oxlint-disable-next-line no-ternary -- Keep expect(received).toEqual argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      expect(received).toEqual(fail ? [{ appPrefix: "test", runtime }] : []);
      expect(events).toEqual([
        // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        ...(runtime === "nodejs" ? ["core"] : []),
        // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        ...(fail ? ["optional"] : []),
      ]);
    });
    /* oxlint-enable oxc/no-async-await */
  }
}
/* oxlint-enable eslint/max-statements */
