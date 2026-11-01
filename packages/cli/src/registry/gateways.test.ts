import { builtInGateways, resolveGateway } from "./gateways";
import { expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const FIRST_GATEWAY_INDEX = 0;
const EPHEMERAL_PORT = 0;

it("validates gateway integration metadata with the standard registry schema", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-metadata-"));
  const source = path.join(cwd, "gateway.json");
  try {
    await writeFile(
      source,
      JSON.stringify(builtInGateways[FIRST_GATEWAY_INDEX])
    );
    const resolvedGateway = await resolveGateway(source);
    expect(resolvedGateway.definition.id).toBe("vercel");
    await writeFile(
      source,
      JSON.stringify({
        ...builtInGateways[FIRST_GATEWAY_INDEX],
        meta: {
          chatjs: {
            ...builtInGateways[FIRST_GATEWAY_INDEX].meta.chatjs,
            contractVersion: 999,
          },
        },
      })
    );
    expect(resolveGateway(source)).rejects.toThrow();
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
it("retains HTTPS enforcement for shadcn requests and redirects", async () => {
  const server = Bun.serve({
    fetch: (request: Readonly<Pick<Request, "url">>) => {
      if (new URL(request.url).pathname === "/gateway.json") {
        return Response.redirect(new URL("/target.json", request.url));
      }
      return Response.json(builtInGateways[FIRST_GATEWAY_INDEX]);
    },
    hostname: "127.0.0.1",
    port: EPHEMERAL_PORT,
  });
  try {
    expect(resolveGateway("http://example.com/gateway.json")).rejects.toThrow(
      "HTTPS"
    );
    expect(
      resolveGateway(`http://127.0.0.1:${server.port}/gateway.json`)
    ).rejects.toThrow("HTTPS");
  } finally {
    await server.stop(true);
  }
});
