import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { installItems } from "./shadcn";
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
    await expect(
      installItems([`http://127.0.0.1:${server.port}/root.json`], cwd)
    ).rejects.toThrow("HTTPS");
    expect(globalThis.fetch).toBe(original);
    expect(await withRegistryTransport(() => "next operation")).toBe(
      "next operation"
    );
    expect(globalThis.fetch).toBe(original);
  } finally {
    server.stop(true);
    await rm(cwd, { force: true, recursive: true });
  }
});
