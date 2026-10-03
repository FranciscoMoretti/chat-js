import { expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { builtInGateways, resolveGateway } from "./gateways";

it("validates gateway integration metadata with the standard registry schema", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-metadata-"));
  const source = path.join(cwd, "gateway.json");
  try {
    await writeFile(source, JSON.stringify(builtInGateways[0]));
    const resolvedGateway = await resolveGateway(source);
    expect(resolvedGateway.definition.id).toBe("vercel");
    await writeFile(
      source,
      JSON.stringify({
        ...builtInGateways[0],
        meta: {
          chatjs: { ...builtInGateways[0].meta.chatjs, contractVersion: 999 },
        },
      })
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(resolveGateway(source)).rejects.toThrow();
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
it("retains HTTPS enforcement for shadcn requests and redirects", async () => {
  const server = Bun.serve({
    fetch: (request) =>
      new URL(request.url).pathname === "/gateway.json"
        ? Response.redirect(new URL("/target.json", request.url))
        : Response.json(builtInGateways[0]),
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      resolveGateway("http://example.com/gateway.json")
    ).rejects.toThrow("HTTPS");
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      resolveGateway(`http://127.0.0.1:${server.port}/gateway.json`)
    ).rejects.toThrow("HTTPS");
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
  }
});
