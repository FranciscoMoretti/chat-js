import { expect, it } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { builtInGateways, resolveGateway } from "./gateways";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
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
    expect(resolveGateway(source)).rejects.toThrow();
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
it("retains HTTPS enforcement for shadcn requests and redirects", async () => {
  const server = Bun.serve({
    fetch: (request) => {
      if (new URL(request.url).pathname === "/gateway.json") {
        return Response.redirect(new URL("/target.json", request.url));
      }
      return Response.json(builtInGateways[0]);
    },
    hostname: "127.0.0.1",
    port: 0,
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
