// Serve the built registry against the locally packed, not-yet-published contracts.
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
const [archive, addressFile] = process.argv.slice(2);
const server = Bun.serve({
	port: 0,
	hostname: "127.0.0.1",
	async fetch(request) {
		const path = new URL(request.url).pathname;
		if (path === "/contracts.tgz") return new Response(Bun.file(archive));
		if (!/^\/[a-z0-9-]+\.json$/.test(path))
			return new Response("Not found", { status: 404 });
		const file = Bun.file(
			join(import.meta.dir, "../../registry/dist/r", path.slice(1)),
		);
		if (!(await file.exists()))
			return new Response("Not found", { status: 404 });
		const item = await file.json();
		if (item.dependencies)
			item.dependencies = item.dependencies.map((d: string) =>
				d.startsWith("@chat-js/gateways@")
					? `@chat-js/gateways@http://127.0.0.1:${server.port}/contracts.tgz`
					: d,
			);
		return Response.json(item);
	},
});
const temporaryAddressFile = `${addressFile}.tmp`;
await writeFile(temporaryAddressFile, `http://127.0.0.1:${server.port}/{name}.json`);
await rename(temporaryAddressFile, addressFile);
