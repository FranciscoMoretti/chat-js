// Serve the locally built registry to standalone scaffold fixtures.
import { rename, writeFile } from "node:fs/promises";
import pathModule from "node:path";

const SCRIPT_ARGUMENTS_START_INDEX = 2;
const URL_PATH_SLASH_LENGTH = 1;
const [addressFile] = process.argv.slice(SCRIPT_ARGUMENTS_START_INDEX);
const server = Bun.serve({
  async fetch(request: Readonly<Pick<Request, "url">>) {
    const path = new URL(request.url).pathname;
    if (await Bun.file(`${addressFile}.offline`).exists()) {
      return new Response("Registry unavailable during recipe replay", {
        status: 503,
      });
    }
    if (!/^\/(?:base\/|radix\/|eve\/)?[a-z0-9-]+\.json$/u.test(path)) {
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
    return new Response(file);
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
