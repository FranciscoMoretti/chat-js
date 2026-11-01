import { describe, expect, it, mock } from "bun:test";

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
interface GitHubState {
  readonly state: string;
  readonly repo: string;
  readonly open: boolean;
  readonly stateBeforeDelete: string;
  readonly openBeforeDelete: boolean;
}
const createGitHub = ({
  state,
  repo,
  open,
  stateBeforeDelete,
  openBeforeDelete,
}: GitHubState): Parameters<typeof cleanupPreviewDatabase>[0]["github"] => ({
  paginate: mock<
    Parameters<typeof cleanupPreviewDatabase>[0]["github"]["paginate"]
  >()
    .mockResolvedValueOnce(open ? [{}] : [])
    .mockResolvedValue(openBeforeDelete ? [{}] : []),
  rest: {
    pulls: {
      get: mock<
        Parameters<
          typeof cleanupPreviewDatabase
        >[0]["github"]["rest"]["pulls"]["get"]
      >()
        .mockResolvedValueOnce({
          data: {
            closed_at: "2026-09-29T00:00:00Z",
            head: { ref: "feature", repo: { full_name: repo } },
            state,
          },
        })
        .mockResolvedValue({
          data: {
            closed_at: "2026-09-29T00:00:00Z",
            head: { ref: "feature", repo: { full_name: repo } },
            state: stateBeforeDelete,
          },
        }),
      list: (): void => {
        // Pagination is handled by the mock; the list method is only a token.
      },
    },
  },
});

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
  const github = createGitHub({
    open,
    openBeforeDelete,
    repo,
    state,
    stateBeforeDelete,
  });
  const request =
    mock<Parameters<typeof cleanupPreviewDatabase>[0]["request"]>();
  for (const page of pages) {
    request.mockResolvedValueOnce(Response.json(page));
  }
  request.mockResolvedValue(new Response(null, { status: deleteStatus }));
  const result = await cleanupPreviewDatabase({
    apiKey: "test-key",
    github,
    number: 123,
    repository: { owner: "owner", repo: "repo" },
    request,
  });
  for (const [, params] of mock(github.paginate).mock.calls) {
    expect(params).toEqual({
      head: "owner:feature",
      owner: "owner",
      per_page: 100,
      repo: "repo",
      state: "open",
    });
  }
  const calls: Call[] = request.mock.calls.map(([url, options]) => ({
    method: options.method ?? "GET",
    url,
  }));
  return { calls, result };
};

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
      expect(calls[1].url).toEndWith("/br-preview");
    }
  });
  it.each([{ state: "open" }, { repo: "fork/repo" }, { open: true }])(
    "skips unsafe PR ownership/state %j",
    async (options: RunOptions): Promise<void> => {
      const { calls } = await run(options);
      expect(calls).toEqual([]);
    }
  );
  it.each([{ stateBeforeDelete: "open" }, { openBeforeDelete: true }])(
    "preserves a preview whose PR use changes during lookup %j",
    async (options: RunOptions): Promise<void> => {
      const { calls, result } = await run(options);
      expect(calls.every((call): boolean => call.method === "GET")).toBe(true);
      expect(result).toContain("Skipped");
    }
  );
});

describe("preview database cleanup", (): void => {
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
});

describe("preview database cleanup", (): void => {
  it("finds later-page previews using the opaque next cursor", async (): Promise<void> => {
    const { calls, result } = await run({
      pages: [
        { branches: [], pagination: { next: "next/page?" } },
        { branches: [preview], pagination: { next: "" } },
      ],
    });
    expect(calls[1].url).toEndWith("?cursor=next%2Fpage%3F");
    expect(result).toContain("Deleted");
  });
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
});

describe("preview database cleanup", (): void => {
  it("treats a missing branch or concurrent deletion as successful cleanup", async (): Promise<void> => {
    const absent = await run({ branches: [] });
    expect(absent.calls).toHaveLength(1);
    const concurrent = await run({ deleteStatus: 404 });
    expect(concurrent.result).toContain("Deleted");
  });
});

describe("preview database cleanup", (): void => {
  it.each([
    { ...preview, id: "br-quiet-pine-za1aryyz" },
    { ...preview, parent_id: rootBranch.parent_id },
    { ...preview, parent_id: "another-parent" },
    { ...preview, default: true },
    { ...preview, primary: true },
    { ...preview, protected: true },
  ])(
    "refuses protected or unrelated branches %j",
    async (branch): Promise<void> => {
      await expectRejection(run({ branches: [branch] }), "Refusing");
    }
  );
  it("rejects ambiguous branch names and reports API failure", async (): Promise<void> => {
    await expectRejection(run({ branches: [preview, preview] }), "ambiguous");
    await expectRejection(run({ deleteStatus: 403 }), "deletion failed (403)");
  });
});
