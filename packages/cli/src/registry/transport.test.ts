import { expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdtemp, rm } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { installItems } from "./shadcn";
import { withRegistryTransport } from "./transport";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
test("shadcn transitive registry requests retain transport policy and restore host fetch", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-transport-"));
  const original = globalThis.fetch;
  const server = Bun.serve({
    fetch: () =>
      Response.json({
        files: [],
        name: "unsafe-dependency",
        registryDependencies: ["http://example.com/insecure.json"],
        type: "registry:item",
      }),
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      installItems([`http://127.0.0.1:${server.port}/root.json`], cwd)
    ).rejects.toThrow("HTTPS");
    expect(globalThis.fetch).toBe(original);
    expect(
      await withRegistryTransport(() => Promise.resolve("next operation"))
    ).toBe("next operation");
    expect(globalThis.fetch).toBe(original);
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
    await rm(cwd, { force: true, recursive: true });
  }
});
/* oxlint-enable typescript/promise-function-async */
