import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { beforeEach, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ updateDocument: vi.fn() }));
vi.mock("@/lib/db/queries", () => queries);
vi.mock("@/lib/auth", () => ({ auth: {} }));

import { documentRouter } from "./document.router";

const user = {
  id: "owner",
  name: "Owner",
  email: "owner@example.test",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const input = {
  id: "document",
  content: "body",
  title: "Title",
  kind: "text",
} satisfies Parameters<
  ReturnType<typeof documentRouter.createCaller>["saveDocument"]
>[0];
beforeEach(() => {
  vi.resetAllMocks();
  queries.updateDocument.mockResolvedValue({ createdAt: new Date() });
});
it("uses verified owner for writes", async () => {
  expect(
    await documentRouter.createCaller({ user }).saveDocument(input)
  ).toEqual({ success: true });
  expect(queries.updateDocument).toHaveBeenCalledWith({
    ...input,
    userId: user.id,
  });
});
it("denies inaccessible and publicly readable foreign documents alike", async () => {
  queries.updateDocument.mockResolvedValue(null);
  await expect(
    documentRouter.createCaller({ user }).saveDocument(input)
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("rejects missing authentication before writing", async () => {
  await expect(
    documentRouter.createCaller({ user: undefined }).saveDocument(input)
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(queries.updateDocument).not.toHaveBeenCalled();
});
it("validates artifact kinds at runtime", async () => {
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    router: documentRouter,
    createContext: () => ({ user }),
    req: new Request("http://fixture/trpc/saveDocument", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { ...input, kind: "not-an-artifact" } }),
    }),
  });
  expect(response.status).toBe(400);
  expect(queries.updateDocument).not.toHaveBeenCalled();
});
