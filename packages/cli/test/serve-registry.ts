// Serve the built registry against the locally packed, not-yet-published contracts.
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { rename, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import pathModule from "node:path";

const SCRIPT_ARGUMENTS_START_INDEX = 2;
const URL_PATH_SLASH_LENGTH = 1;
const [archive, addressFile] = process.argv.slice(SCRIPT_ARGUMENTS_START_INDEX);
/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const server = Bun.serve({
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetch's awaited sequencing and rejected-Promise behavior. */
  async fetch(request: Readonly<Pick<Request, "url">>) {
    const path = new URL(request.url).pathname;
    if (path === "/contracts.tgz") {
      return new Response(Bun.file(archive));
    }
    if (!/^\/[a-z0-9-]+\.json$/u.test(path)) {
      return new Response("Not found", { status: 404 });
    }
    const file = Bun.file(
      pathModule.join(
        import.meta.dir,
        "../../registry/dist/r",
        path.slice(URL_PATH_SLASH_LENGTH)
      )
    );
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- These dependency names come from the registry package catalog; the indexed access preserves their pinned versions.
    const item = await file.json();
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- These dependency names come from the registry package catalog; the indexed access preserves their pinned versions.
    if (item.dependencies) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- These dependency names come from the registry package catalog; the indexed access preserves their pinned versions.
      item.dependencies = item.dependencies.map((dependency: string) => {
        if (dependency.startsWith("@chat-js/gateways@")) {
          return `@chat-js/gateways@http://127.0.0.1:${server.port}/contracts.tgz`;
        }
        return dependency;
      });
    }
    return Response.json(item);
  },
  /* oxlint-enable oxc/no-async-await */
  hostname: "127.0.0.1",
  port: 0,
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/max-statements */
const temporaryAddressFile = `${addressFile}.tmp`;
// oxlint-disable-next-line node/no-top-level-await -- This Bun fixture server writes its bound address before advertising readiness to the integration process.
await writeFile(
  temporaryAddressFile,
  `http://127.0.0.1:${server.port}/{name}.json`
);
// oxlint-disable-next-line node/no-top-level-await -- This Bun fixture server atomically publishes its completed address file for integration consumers.
await rename(temporaryAddressFile, addressFile);
