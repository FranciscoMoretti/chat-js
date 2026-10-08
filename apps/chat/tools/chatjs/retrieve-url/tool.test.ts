import { beforeEach, expect, test, vi } from "vitest";
import { testToolContext } from "@/tests/helpers/eve-tool-context";
import { toolResultSchema } from "@/lib/eve/tool-result";

const mocks = vi.hoisted(() => ({
  env: { FIRECRAWL_API_KEY: "test-key" },
  extract: vi.fn(),
  scrape: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@mendable/firecrawl-js", () => ({
  default: class {
    public scrapeUrl = mocks.scrape;
    public extract = mocks.extract;
  },
}));
vi.mock(
  "@/lib/logger",
  (): { createModuleLogger: () => { error: () => void } } => ({
    createModuleLogger: (): { error: () => void } => ({
      error: vi.fn<() => void>(),
    }),
  })
);
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.env.FIRECRAWL_API_KEY = "test-key";
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each(["missing configuration", "invalid URL"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test.each(["missing configuration", "invalid URL"])("%s produces a zero-cost receipt  uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test.each(["missing configuration", "invalid URL"])(
  "%s produces a zero-cost receipt without calling Firecrawl",
  async (reason) => {
    if (reason === "missing configuration") {
      mocks.env.FIRECRAWL_API_KEY = "";
    }
    const { retrieveUrl } = await import("./tool");
    const result = await retrieveUrl.execute(
      {
        url:
          // oxlint-disable-next-line no-ternary -- Keep url as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          reason === "invalid URL" ? "file:///private" : "https://example.com",
      },
      testToolContext()
    );
    expect(toolResultSchema.parse(result).usage.costUsd).toBe(0);
    expect(mocks.scrape).not.toHaveBeenCalled();
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([false, true])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

test.each([false, true])(
  "provider completion keeps unknown cost explicit (failure=%s)",
  async (fails) => {
    if (fails) {
      mocks.scrape.mockRejectedValue(new Error("remote failure"));
    } else {
      mocks.scrape.mockResolvedValue({
        markdown: "Content",
        metadata: { description: "Description", title: "Page" },
        success: true,
      });
    }
    const { retrieveUrl } = await import("./tool");
    const result = await retrieveUrl.execute(
      { url: "https://example.com" },
      testToolContext()
    );
    expect(toolResultSchema.parse(result).usage.costUsd).toBeUndefined();
    expect(mocks.scrape).toHaveBeenCalledOnce();
  }
);
/* oxlint-enable oxc/no-async-await */
