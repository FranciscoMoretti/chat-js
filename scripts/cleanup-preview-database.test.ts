import { describe, expect, it } from "bun:test";

import { cleanupPreviewDatabase } from "./cleanup-preview-database.mjs";

const preview: Branch = {
  created_at: "2026-09-28T00:00:00Z",
  id: "br-preview",
  name: "preview/feature",
  parent_id: "br-quiet-pine-za1aryyz",
};
const rootBranch: Branch = {
  created_at: "2026-01-01T00:00:00Z",
  default: true,
  id: "br-root",
  name: "main",
  // oxlint-disable-next-line unicorn/no-null -- Exercise Neon's explicit null parent sentinel separately from an omitted parent_id in a root-branch API response.
  parent_id: null,
  protected: false,
};
interface Call {
  readonly method: string;
  readonly url: string;
}
interface Branch {
  readonly created_at: string;
  readonly default?: boolean;
  readonly id: string;
  readonly name: string;
  readonly parent_id?: string | null;
  readonly primary?: boolean;
  readonly protected?: boolean;
}
interface RunOptions {
  readonly state?: string;
  readonly repo?: string;
  readonly open?: boolean;
  readonly branches?: readonly Branch[];
  readonly deleteStatus?: number;
  readonly pages?: readonly {
    readonly branches: readonly Branch[];
    readonly pagination: Readonly<{ next: string }>;
  }[];
  readonly stateBeforeDelete?: string;
  readonly openBeforeDelete?: boolean;
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve expectRejection's awaited sequencing and rejected-Promise behavior. */
const expectRejection = async (
  operation: Readonly<Promise<unknown>>,
  messageFragment?: string
): Promise<void> => {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error) {
      if (
        typeof messageFragment === "string" &&
        !error.message.includes(messageFragment)
      ) {
        throw new Error(`Unexpected rejection: ${error.message}`, {
          cause: error,
        });
      }
      return;
    }
    throw new Error(`Unexpected rejection: ${String(error)}`, { cause: error });
  }
  throw new Error("Expected the operation to reject.");
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-lines-per-function -- run: The scenario deliberately keeps its setup/action/assertions and cleanup in one lifetime. */
/* oxlint-disable typescript/explicit-function-return-type -- run: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable eslint/no-magic-numbers -- run: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
/* oxlint-disable unicorn/no-null -- run: The fixture explicitly exercises the null state required by the API. */
/* oxlint-disable typescript/promise-function-async -- run: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
type RunResult = Readonly<{
  calls: readonly Call[];
  result: Awaited<ReturnType<typeof cleanupPreviewDatabase>>;
}>;
const run = async ({
  state = "closed",
  repo = "owner/repo",
  open = false,
  branches = [preview],
  deleteStatus = 200,
  pages = [{ branches, pagination: { next: "" } }],
  stateBeforeDelete = state,
  openBeforeDelete = open,
}: RunOptions = {}): Promise<RunResult> => {
  const calls: Call[] = [];
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
        listCount += 1;
        if (listCount === 1) {
          if (open) {
            return Promise.resolve([{}]);
          }
          return Promise.resolve([]);
        }
        if (openBeforeDelete) {
          return Promise.resolve([{}]);
        }
        return Promise.resolve([]);
      },
      rest: {
        pulls: {
          get: () =>
            Promise.resolve({
              data: {
                closed_at: "2026-09-29T00:00:00Z",
                head: { ref: "feature", repo: { full_name: repo } },
                // oxlint-disable-next-line no-ternary -- Keep state as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    request: (url: string, options: Readonly<Pick<RequestInit, "method">>) => {
      calls.push({ method: options.method ?? "GET", url });
      return Promise.resolve(
        // oxlint-disable-next-line no-ternary -- Keep Promise.resolve argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        options.method === "DELETE"
          ? new Response(null, { status: deleteStatus })
          : Response.json(pages[(pageIndex += 1) - 1])
      );
    },
  });
  return { calls, result };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-lines-per-function -- preview database cleanup: The scenario deliberately keeps its setup/action/assertions and cleanup in one lifetime. */
/* oxlint-disable eslint/no-magic-numbers -- preview database cleanup: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
describe("preview database cleanup", (): void => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("accepts root branches with null or absent parent_id beside the preview", async (): Promise<void> => {
    const absentParent: Branch = {
      created_at: rootBranch.created_at,
      id: rootBranch.id,
      name: rootBranch.name,
    };
    const results = await Promise.all(
      [rootBranch, absentParent].map(
        async (root) => await run({ branches: [root, preview] })
      )
    );
    for (const { calls } of results) {
      expect(calls.map((call): string => call.method)).toEqual([
        "GET",
        "DELETE",
      ]);
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading url from calls[1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      expect(calls[1]?.url).toEndWith("/br-preview");
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([{ state: "open" }, { repo: "fork/repo" }, { open: true }])'s awaited sequencing and rejected-Promise behavior. */
  it.each([{ state: "open" }, { repo: "fork/repo" }, { open: true }])(
    "skips unsafe PR ownership/state %j",
    async (options: RunOptions): Promise<void> => {
      const { calls } = await run(options);
      expect(calls).toEqual([]);
    }
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([{ stateBeforeDelete: "open" }, { openBeforeDelete: true }])'s awaited sequencing and rejected-Promise behavior. */
  it.each([{ stateBeforeDelete: "open" }, { openBeforeDelete: true }])(
    "preserves a preview whose PR use changes during lookup %j",
    async (options: RunOptions): Promise<void> => {
      const { calls, result } = await run(options);
      expect(calls.every((call): boolean => call.method === "GET")).toBe(true);
      expect(result).toContain("Skipped");
    }
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["2026-09-30T00:00:00Z", "invalid"])'s awaited sequencing and rejected-Promise behavior. */
  it.each(["2026-09-30T00:00:00Z", "invalid"])(
    "preserves recreated previews or unknown creation dates %s",
    async (created_at): Promise<void> => {
      const { calls, result } = await run({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        branches: [{ ...preview, created_at }],
      });
      expect(calls).toHaveLength(1);
      expect(result).toContain("Skipped");
    }
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("finds later-page previews using the opaque next cursor", async (): Promise<void> => {
    const { calls, result } = await run({
      pages: [
        { branches: [], pagination: { next: "next/page?" } },
        { branches: [preview], pagination: { next: "" } },
      ],
    });
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading url from calls[1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(calls[1]?.url).toEndWith("?cursor=next%2Fpage%3F");
    expect(result).toContain("Deleted");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("checks uniqueness across all pages and rejects looping pagination", async (): Promise<void> => {
    await expectRejection(
      run({
        pages: [
          { branches: [preview], pagination: { next: "page2" } },
          { branches: [preview], pagination: { next: "" } },
        ],
      }),
      "ambiguous"
    );
    await expectRejection(
      run({
        pages: [
          { branches: [preview], pagination: { next: "page2" } },
          { branches: [], pagination: { next: "page2" } },
        ],
      }),
      "repeated"
    );
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("treats a missing branch or concurrent deletion as successful cleanup", async (): Promise<void> => {
    const absent = await run({ branches: [] });
    expect(absent.calls).toHaveLength(1);
    const concurrent = await run({ deleteStatus: 404 });
    expect(concurrent.result).toContain("Deleted");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([     { ...preview, id: "br-quiet-pine-za1aryyz" },     { ...preview, parent_id: rootBranch.'s awaited sequencing and rejected-Promise behavior. */
  it.each([
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...preview, id: "br-quiet-pine-za1aryyz" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...preview, parent_id: rootBranch.parent_id },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...preview, parent_id: "another-parent" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...preview, default: true },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...preview, primary: true },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...preview, protected: true },
  ])(
    "refuses protected or unrelated branches %j",
    async (branch): Promise<void> => {
      await expectRejection(run({ branches: [branch] }), "Refusing");
    }
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("rejects ambiguous branch names and reports API failure", async (): Promise<void> => {
    await expectRejection(run({ branches: [preview, preview] }), "ambiguous");
    await expectRejection(run({ deleteStatus: 403 }), "deletion failed (403)");
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
