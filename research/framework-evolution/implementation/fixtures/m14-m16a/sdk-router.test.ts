import { expect, test } from "bun:test";
import { Files, FilesError } from "files-sdk";
import { createFilesRouter } from "files-sdk/api";
import { memory } from "files-sdk/memory";

test("native Files SDK authorization gate checks key before metadata/range/download and denies mutations", async () => {
	const files = new Files({ adapter: memory(), retries: 0 });
	await files.upload("private-file", "0123456789", {
		contentType: "text/plain",
	});
	const token = crypto.randomUUID();
	const router = createFilesRouter({
		secret: crypto.randomUUID(),
		files,
		operations: ["download", "head"],
		downloadMode: "proxy",
		authorize({ req, key }) {
			if (
				req.headers.get("authorization") !== `Bearer ${token}` ||
				key !== "private-file"
			)
				throw new FilesError("Unauthorized", "Denied");
		},
	});
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: router.handle,
	});
	try {
		const url = new URL("/?op=download&key=private-file", server.url);
		const owner = await fetch(url, {
			headers: { authorization: `Bearer ${token}`, range: "bytes=2-5" },
		});
		expect(owner.status).toBe(206);
		expect(await owner.text()).toBe("2345");
		expect(owner.headers.get("content-range")).toBe("bytes 2-5/10");
		const unauthorized = await fetch(url, {
			headers: { authorization: "Bearer other" },
		});
		expect(unauthorized.status).toBe(401);
		expect(await unauthorized.text()).not.toContain("0123456789");
		const otherKey = await fetch(
			new URL("/?op=download&key=other", server.url),
			{ headers: { authorization: `Bearer ${token}` } },
		);
		expect(otherKey.ok).toBe(false);
		const head = await fetch(server.url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: server.url.origin,
				authorization: "Bearer other",
			},
			body: JSON.stringify({ op: "head", key: "private-file" }),
		});
		expect(head.status).toBe(401);
		const mutation = await fetch(server.url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: server.url.origin,
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ op: "delete", key: "private-file" }),
		});
		expect(mutation.status).toBe(403);
		expect(await (await files.download("private-file")).text()).toBe(
			"0123456789",
		);
	} finally {
		await server.stop(true);
	}
});
