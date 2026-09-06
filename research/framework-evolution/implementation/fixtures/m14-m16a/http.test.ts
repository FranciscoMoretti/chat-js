import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client";
import { boundary, type DocumentRouter } from "./api.server";
import { textResult } from "./contract";

test("real HTTP tRPC and Files boundaries; actual AI SDK tool return matches UI query", async () => {
	const root = await mkdtemp(join(tmpdir(), "boundary-"));
	const api = boundary(
		join(root, "documents.db"),
		join(root, "bytes"),
		join(root, "files.db"),
	);
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: api.handle,
	});
	function client(token: string) {
		return createTRPCClient<DocumentRouter>({
			links: [
				httpLink({
					url: new URL("/trpc", server.url).href,
					headers: { authorization: `Bearer ${token}` },
				}),
			],
		});
	}
	const alice = client(api.credentials.alice);
	const bob = client(api.credentials.bob);
	try {
		const create = api.toolsFor("alice").create;
		if (!create.execute) throw new Error("Missing tool execute");
		const output = await create.execute(
			{ title: "Tool document", content: "one" },
			{ toolCallId: "call-1", messages: [], context: {} },
		);
		const result = textResult.parse(JSON.parse(JSON.stringify(output)));
		expect(await alice.getRevision.query(result.ref)).toMatchObject({
			...result.ref,
			content: "one",
		});
		await expect(bob.getRevision.query(result.ref)).rejects.toMatchObject({
			data: { code: "NOT_FOUND" },
		});
		await expect(
			bob.edit.mutate({
				documentId: result.ref.documentId,
				baseRevisionId: result.ref.revisionId,
				title: "steal",
				content: "bad",
			}),
		).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
		await expect(
			client("forged").create.mutate({ title: "bad", content: "bad" }),
		).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
		const input = {
			documentId: result.ref.documentId,
			baseRevisionId: result.ref.revisionId,
			title: "edit",
			content: "two",
		};
		const attempts = await Promise.allSettled([
			alice.edit.mutate(input),
			alice.edit.mutate({ ...input, content: "three" }),
		]);
		expect(
			attempts.filter((value) => value.status === "fulfilled"),
		).toHaveLength(1);
		const rejected = attempts.find((value) => value.status === "rejected");
		expect(
			rejected?.status === "rejected" &&
				rejected.reason instanceof TRPCClientError &&
				rejected.reason.data.code,
		).toBe("CONFLICT");
		expect((await alice.getRevision.query(result.ref)).content).toBe("one");
		const bobTool = api.toolsFor("bob").edit;
		if (!bobTool.execute) throw new Error("Missing edit execute");
		await expect(
			bobTool.execute(input, {
				toolCallId: "call-2",
				messages: [],
				context: {},
			}),
		).rejects.toThrow("NOT_FOUND");
		const form = new FormData();
		form.set(
			"file",
			new File(["fixture bytes"], "fixture.pdf", { type: "application/pdf" }),
		);
		const upload = await fetch(new URL("/files", server.url), {
			method: "POST",
			body: form,
			headers: { authorization: `Bearer ${api.credentials.alice}` },
		});
		expect(upload.status).toBe(200);
		expect(
			(
				await fetch(new URL("/files", server.url), {
					method: "POST",
					body: form,
					headers: {
						authorization: `Bearer ${api.credentials.alice}`,
						origin: "https://untrusted.example",
					},
				})
			).status,
		).toBe(403);
		const uploaded: unknown = await upload.json();
		const { z } = await import("zod");
		const ref = z.object({ fileId: z.uuid() }).parse(uploaded);
		for (const [token, status] of [
			[api.credentials.alice, 200],
			[api.credentials.bob, 404],
			["forged", 401],
		] satisfies [string, number][]) {
			const response = await fetch(
				new URL(`/files/${ref.fileId}`, server.url),
				{ headers: { authorization: `Bearer ${token}` } },
			);
			expect(response.status).toBe(status);
			if (status === 200) expect(await response.text()).toBe("fixture bytes");
		}
		expect(
			(
				await fetch(new URL(`/files/${ref.fileId}`, server.url), {
					method: "PUT",
					body: "overwrite",
					headers: { authorization: `Bearer ${api.credentials.bob}` },
				})
			).status,
		).toBe(405);
		expect(
			(
				await fetch(new URL("/files", server.url), {
					method: "POST",
					body: form,
				})
			).status,
		).toBe(401);
	} finally {
		await server.stop(true);
		api.close();
		await rm(root, { recursive: true, force: true });
	}
});
