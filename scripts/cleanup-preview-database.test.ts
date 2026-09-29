import { describe, expect, it } from "bun:test";

import { cleanupPreviewDatabase } from "./cleanup-preview-database.mjs";

const preview = {
  created_at: "2026-09-28T00:00:00Z",
  id: "br-preview",
  name: "preview/feature",
  parent_id: "br-quiet-pine-za1aryyz",
};
const run = async ({
  state = "closed",
  repo = "owner/repo",
  open = false,
  branches = [preview],
  deleteStatus = 200,
  pages = [{ branches, pagination: { next: "" } }],
  stateBeforeDelete = state,
  openBeforeDelete = open,
} = {}) => {
  const calls: { method: string; url: string }[] = [];
  let getCount = 0;
  let listCount = 0;
  let pageIndex = 0;
  const result = await cleanupPreviewDatabase({
    apiKey: "test-key",
    github: {
      paginate: (_method: unknown, params: unknown) => {
        expect(params).toEqual({
          head: "owner:feature",
          owner: "owner",
          per_page: 100,
          repo: "repo",
          state: "open",
        });
        return Promise.resolve(
          ((listCount += 1) === 1 ? open : openBeforeDelete) ? [{}] : []
        );
      },
      rest: {
        pulls: {
          get: () =>
            Promise.resolve({
              data: {
                closed_at: "2026-09-29T00:00:00Z",
                head: { ref: "feature", repo: { full_name: repo } },
                state: (getCount += 1) === 1 ? state : stateBeforeDelete,
              },
            }),
          list: () => {},
        },
      },
    },
    number: 123,
    repository: { owner: "owner", repo: "repo" },
    request: (url: string, options: RequestInit) => {
      calls.push({ method: options.method ?? "GET", url });
      return Promise.resolve(
        options.method === "DELETE"
          ? new Response(null, { status: deleteStatus })
          : Response.json(pages[(pageIndex += 1) - 1])
      );
    },
  });
  return { calls, result };
};

describe("preview database cleanup", () => {
  it("deletes only the exact closed-PR preview in the dedicated project", async () => {
    const { calls } = await run();
    expect(calls).toEqual([
      {
        method: "GET",
        url: "https://console.neon.tech/api/v2/projects/flat-pine-61604628/branches",
      },
      {
        method: "DELETE",
        url: "https://console.neon.tech/api/v2/projects/flat-pine-61604628/branches/br-preview",
      },
    ]);
  });
  it.each([{ state: "open" }, { repo: "fork/repo" }, { open: true }])(
    "skips unsafe PR ownership/state %j",
    async (options) => {
      const { calls } = await run(options);
      expect(calls).toEqual([]);
    }
  );
  it.each([{ stateBeforeDelete: "open" }, { openBeforeDelete: true }])(
    "preserves a preview whose PR use changes during lookup %j",
    async (options) => {
      const { calls, result } = await run(options);
      expect(calls.every((call) => call.method === "GET")).toBe(true);
      expect(result).toContain("Skipped");
    }
  );
  it.each(["2026-09-30T00:00:00Z", "invalid"])(
    "preserves recreated previews or unknown creation dates %s",
    async (created_at) => {
      const { calls, result } = await run({
        branches: [{ ...preview, created_at }],
      });
      expect(calls).toHaveLength(1);
      expect(result).toContain("Skipped");
    }
  );
  it("finds later-page previews using the opaque next cursor", async () => {
    const { calls, result } = await run({
      pages: [
        { branches: [], pagination: { next: "next/page?" } },
        { branches: [preview], pagination: { next: "" } },
      ],
    });
    expect(calls[1]?.url).toEndWith("?cursor=next%2Fpage%3F");
    expect(result).toContain("Deleted");
  });
  it("checks uniqueness across all pages and rejects looping pagination", async () => {
    await expect(
      run({
        pages: [
          { branches: [preview], pagination: { next: "page2" } },
          { branches: [preview], pagination: { next: "" } },
        ],
      })
    ).rejects.toThrow("ambiguous");
    await expect(
      run({
        pages: [
          { branches: [preview], pagination: { next: "page2" } },
          { branches: [], pagination: { next: "page2" } },
        ],
      })
    ).rejects.toThrow("repeated");
  });
  it("treats a missing branch or concurrent deletion as successful cleanup", async () => {
    const absent = await run({ branches: [] });
    expect(absent.calls).toHaveLength(1);
    const concurrent = await run({ deleteStatus: 404 });
    expect(concurrent.result).toContain("Deleted");
  });
  it.each([
    { ...preview, id: "br-quiet-pine-za1aryyz" },
    { ...preview, parent_id: "another-parent" },
    { ...preview, default: true },
    { ...preview, primary: true },
    { ...preview, protected: true },
  ])("refuses protected or unrelated branches %j", async (branch) => {
    await expect(run({ branches: [branch] })).rejects.toThrow("Refusing");
  });
  it("rejects ambiguous branch names and reports API failure", async () => {
    await expect(run({ branches: [preview, preview] })).rejects.toThrow(
      "ambiguous"
    );
    await expect(run({ deleteStatus: 403 })).rejects.toThrow(
      "deletion failed (403)"
    );
  });
});
