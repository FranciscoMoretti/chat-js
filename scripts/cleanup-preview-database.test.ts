import { describe, expect, it } from "bun:test";

import { cleanupPreviewDatabase } from "./cleanup-preview-database.mjs";

const preview = {
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
} = {}) => {
  const calls: { method: string; url: string }[] = [];
  const result = await cleanupPreviewDatabase({
    apiKey: "test-key",
    github: {
      paginate: () => Promise.resolve(open ? [{}] : []),
      rest: {
        pulls: {
          get: () =>
            Promise.resolve({
              data: {
                head: { ref: "feature", repo: { full_name: repo } },
                state,
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
          : Response.json({ branches })
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
