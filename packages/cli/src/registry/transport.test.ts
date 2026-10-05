import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installItems } from "./shadcn";
/* oxlint-enable sort-imports */
import { withRegistryTransport } from "./transport";

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
    expect(
      installItems([`http://127.0.0.1:${server.port}/root.json`], cwd)
    ).rejects.toThrow("HTTPS");
    expect(globalThis.fetch).toBe(original);
    expect(
      await withRegistryTransport(
        async () => await Promise.resolve("next operation")
      )
    ).toBe("next operation");
    expect(globalThis.fetch).toBe(original);
  } finally {
    await server.stop(true);
    await rm(cwd, { force: true, recursive: true });
  }
});
