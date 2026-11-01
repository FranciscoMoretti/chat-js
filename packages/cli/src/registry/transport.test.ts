import { expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { installItems } from "./shadcn";
import path from "node:path";
import { tmpdir } from "node:os";
import { withRegistryTransport } from "./transport";

test("registry policy rejects insecure fetch before sending a request and restores host fetch", () => {
  const original = globalThis.fetch;
  const nativeFetch = Object.assign(mock<typeof fetch>(), {
    preconnect: original.preconnect,
  });
  globalThis.fetch = nativeFetch;
  try {
    expect(
      withRegistryTransport(
        async () => await fetch("http://example.com/insecure.json")
      )
    ).rejects.toThrow("HTTPS");
    expect(nativeFetch).not.toHaveBeenCalled();
    expect(globalThis.fetch).toBe(nativeFetch);
  } finally {
    globalThis.fetch = original;
  }
});

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
        mock<() => Promise<string>>().mockResolvedValue("next operation")
      )
    ).toBe("next operation");
    expect(globalThis.fetch).toBe(original);
  } finally {
    await server.stop(true);
    await rm(cwd, { force: true, recursive: true });
  }
});
