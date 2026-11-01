// Serve the built registry against the locally packed, not-yet-published contracts.
import { rename, writeFile } from "node:fs/promises";
import pathModule from "node:path";
import { z } from "zod";

const SCRIPT_ARGUMENTS_START_INDEX = 2;
const URL_PATH_SLASH_LENGTH = 1;
const registryResponseSchema = z.looseObject({
  dependencies: z.array(z.string()).optional(),
});
const [archive, sandboxArchive, addressFile] = process.argv.slice(
  SCRIPT_ARGUMENTS_START_INDEX
);
const server = Bun.serve({
  async fetch(request: Readonly<Pick<Request, "url">>) {
    const path = new URL(request.url).pathname;
    if (path === "/contracts.tgz") {
      return new Response(Bun.file(archive));
    }
    if (path === "/sandboxes.tgz") {
      return new Response(Bun.file(sandboxArchive));
    }
    if (!/^\/(?:base\/|radix\/)?[a-z0-9-]+\.json$/u.test(path)) {
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
    const item = registryResponseSchema.parse(await file.json());
    if (item.dependencies !== undefined) {
      item.dependencies = item.dependencies.map((dependency: string) => {
        if (dependency.startsWith("@chat-js/gateways@")) {
          return `@chat-js/gateways@http://127.0.0.1:${server.port}/contracts.tgz`;
        }
        if (dependency.startsWith("@chat-js/sandboxes@")) {
          return `@chat-js/sandboxes@http://127.0.0.1:${server.port}/sandboxes.tgz`;
        }
        return dependency;
      });
    }
    return Response.json(item);
  },
  hostname: "127.0.0.1",
  port: 0,
});
// The base template includes the runtime contract even without a selected provider.
const templateManifest = pathModule.join(
  import.meta.dir,
  "../templates/chat-app/package.json"
);
const template = await Bun.file(templateManifest).text();
await writeFile(
  templateManifest,
  template.replace(
    /(?<prefix>"@chat-js\/sandboxes": )"[^"]+"/u,
    `$<prefix>"http://127.0.0.1:${server.port}/sandboxes.tgz"`
  )
);
const temporaryAddressFile = `${addressFile}.tmp`;
await writeFile(
  temporaryAddressFile,
  `http://127.0.0.1:${server.port}/{name}.json`
);
await rename(temporaryAddressFile, addressFile);
