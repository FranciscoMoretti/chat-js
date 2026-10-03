import { describe, expect, it } from "bun:test";

import { cleanupPreviewDatabase } from "./cleanup-preview-database.mjs";

const preview = {
  created_at: "2026-09-28T00:00:00Z",
  id: "br-preview",
  name: "preview/feature",
  parent_id: "br-quiet-pine-za1aryyz",
};
/* oxlint-disable typescript/consistent-type-definitions -- RunOptions: The structural alias participates in typed JSON/configuration boundaries; interface conversion changes implicit index assignability and merging. */
type RunOptions = {
  state?: string;
  repo?: string;
  open?: boolean;
  branches?: (typeof preview & {
    default?: boolean;
    primary?: boolean;
    protected?: boolean;
  })[];
  deleteStatus?: number;
  pages?: { branches: (typeof preview)[]; pagination: { next: string } }[];
  stateBeforeDelete?: string;
  openBeforeDelete?: boolean;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-disable eslint/max-lines-per-function -- run: The scenario deliberately keeps its setup/action/assertions and cleanup in one lifetime. */
/* oxlint-disable typescript/explicit-function-return-type -- run: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable eslint/no-magic-numbers -- run: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
/* oxlint-disable unicorn/no-null -- run: The fixture explicitly exercises the null state required by the API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- run: The test intentionally exercises mutable SDK/fixture objects; deep-readonly parameters would change their assignability. */
/* oxlint-disable typescript/promise-function-async -- run: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const run = async ({
  state = "closed",
  repo = "owner/repo",
  open = false,
  branches = [preview],
  deleteStatus = 200,
  pages = [{ branches, pagination: { next: "" } }],
  stateBeforeDelete = state,
  openBeforeDelete = open,
}: RunOptions = {}) => {
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
          list: (): void => {
            // Pagination is handled by the mock; the list method is only a token.
          },
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-lines-per-function -- preview database cleanup: The scenario deliberately keeps its setup/action/assertions and cleanup in one lifetime. */
/* oxlint-disable eslint/no-magic-numbers -- preview database cleanup: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- preview database cleanup: The test intentionally exercises mutable SDK/fixture objects; deep-readonly parameters would change their assignability. */
describe("preview database cleanup", (): void => {
  it("deletes only the exact closed-PR preview in the dedicated project", async (): Promise<void> => {
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
    async (options): Promise<void> => {
      const { calls } = await run(options);
      expect(calls).toEqual([]);
    }
  );
  it.each([{ stateBeforeDelete: "open" }, { openBeforeDelete: true }])(
    "preserves a preview whose PR use changes during lookup %j",
    async (options): Promise<void> => {
      const { calls, result } = await run(options);
      expect(calls.every((call): boolean => call.method === "GET")).toBe(true);
      expect(result).toContain("Skipped");
    }
  );
  it.each(["2026-09-30T00:00:00Z", "invalid"])(
    "preserves recreated previews or unknown creation dates %s",
    async (created_at): Promise<void> => {
      const { calls, result } = await run({
        branches: [{ ...preview, created_at }],
      });
      expect(calls).toHaveLength(1);
      expect(result).toContain("Skipped");
    }
  );
  it("finds later-page previews using the opaque next cursor", async (): Promise<void> => {
    const { calls, result } = await run({
      pages: [
        { branches: [], pagination: { next: "next/page?" } },
        { branches: [preview], pagination: { next: "" } },
      ],
    });
    expect(calls[1]?.url).toEndWith("?cursor=next%2Fpage%3F");
    expect(result).toContain("Deleted");
  });
  it("checks uniqueness across all pages and rejects looping pagination", async (): Promise<void> => {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
    await expect(
      run({
        pages: [
          { branches: [preview], pagination: { next: "page2" } },
          { branches: [preview], pagination: { next: "" } },
        ],
      })
    ).rejects.toThrow("ambiguous");
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
    await expect(
      run({
        pages: [
          { branches: [preview], pagination: { next: "page2" } },
          { branches: [], pagination: { next: "page2" } },
        ],
      })
    ).rejects.toThrow("repeated");
  });
  it("treats a missing branch or concurrent deletion as successful cleanup", async (): Promise<void> => {
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
  ])(
    "refuses protected or unrelated branches %j",
    async (branch): Promise<void> => {
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
      await expect(run({ branches: [branch] })).rejects.toThrow("Refusing");
    }
  );
  it("rejects ambiguous branch names and reports API failure", async (): Promise<void> => {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
    await expect(run({ branches: [preview, preview] })).rejects.toThrow(
      "ambiguous"
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
    await expect(run({ deleteStatus: 403 })).rejects.toThrow(
      "deletion failed (403)"
    );
  });
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
