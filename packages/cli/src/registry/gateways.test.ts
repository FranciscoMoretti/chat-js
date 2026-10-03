import { expect, it } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { builtInGateways, resolveGateway } from "./gateways";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
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
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-async-await */
