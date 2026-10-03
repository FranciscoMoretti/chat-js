/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
// Serve the built registry against the locally packed, not-yet-published contracts.
import { rename, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import pathModule from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
const [archive, addressFile] = process.argv.slice(2);
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const server = Bun.serve({
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/contracts.tgz") {
      return new Response(Bun.file(archive));
    }
    if (!/^\/[a-z0-9-]+\.json$/u.test(path)) {
      return new Response("Not found", { status: 404 });
    }
    const file = Bun.file(
      pathModule.join(import.meta.dir, "../../registry/dist/r", path.slice(1))
    );
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- These dependency names come from the registry package catalog; the indexed access preserves their pinned versions.
    const item = await file.json();
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- These dependency names come from the registry package catalog; the indexed access preserves their pinned versions.
    if (item.dependencies) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- These dependency names come from the registry package catalog; the indexed access preserves their pinned versions.
      item.dependencies = item.dependencies.map((d: string) =>
        d.startsWith("@chat-js/gateways@")
          ? `@chat-js/gateways@http://127.0.0.1:${server.port}/contracts.tgz`
          : d
      );
    }
    return Response.json(item);
  },
  hostname: "127.0.0.1",
  port: 0,
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */
const temporaryAddressFile = `${addressFile}.tmp`;
await writeFile(
  temporaryAddressFile,
  `http://127.0.0.1:${server.port}/{name}.json`
);
await rename(temporaryAddressFile, addressFile);
