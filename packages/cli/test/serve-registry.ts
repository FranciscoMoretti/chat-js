// Serve the built registry against the locally packed, not-yet-published contracts.
import { rename, writeFile } from "node:fs/promises";
import pathModule from "node:path";

const [archive, addressFile] = process.argv.slice(2);
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
const temporaryAddressFile = `${addressFile}.tmp`;
await writeFile(
  temporaryAddressFile,
  `http://127.0.0.1:${server.port}/{name}.json`
);
await rename(temporaryAddressFile, addressFile);
