import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { testToolContext } from "@/tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  extract: vi.fn(),
  scrape: vi.fn(),
}));
vi.mock("@mendable/firecrawl-js", () => ({
  default: class {
    public scrapeUrl = mocks.scrape;
    public extract = mocks.extract;
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
});

afterEach(() => vi.unstubAllEnvs());

test("invalid successful scrape rejects instead of becoming a retrieval failure", async () => {
  mocks.scrape.mockResolvedValue({
    markdown: "Content",
    metadata: { description: "Description", language: 42, title: "Page" },
    success: true,
  });
  const { retrieveUrl } = await import("./tool");
  await expect(
    retrieveUrl.execute({ url: "https://example.com" }, testToolContext())
  ).rejects.toBeInstanceOf(z.ZodError);
});

test.each([
  ["missing configuration", "https://example.com"],
  ["invalid URL", "file:///private"],
])(
  "%s returns an actionable native error without calling Firecrawl",
  async (reason, url) => {
    if (reason === "missing configuration") {
      vi.stubEnv("FIRECRAWL_API_KEY", "");
    }
    const { retrieveUrl } = await import("./tool");
    const result = await retrieveUrl.execute(
      {
        url,
      },
      testToolContext()
    );
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("usage");
    expect(mocks.scrape).not.toHaveBeenCalled();
  }
);

test.each([false, true])(
  "provider completion returns native data or a sanitized error (failure=%s)",
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
    expect(result).toEqual(
      fails
        ? { error: "Failed to retrieve content" }
        : {
            results: [
              {
                content: "Content",
                description: "Description",
                title: "Page",
                url: "https://example.com/",
              },
            ],
          }
    );
    expect(result).not.toHaveProperty("usage");
    expect(mocks.scrape).toHaveBeenCalledOnce();
  }
);

test.each([
  {
    data: {
      content: "Extracted content",
      description: "Extracted description",
      title: "Extracted title",
    },
    expected: {
      content: "Extracted content",
      description: "Extracted description",
      title: "Scraped title",
    },
  },
  {
    data: {
      content: "Valid extracted content",
      description: "Valid extracted description",
      title: { malformed: true },
    },
    expected: {
      content: "Valid extracted content",
      description: "Valid extracted description",
      title: "Scraped title",
    },
  },
  {
    data: { description: "Partial description" },
    expected: {
      content: "",
      description: "Partial description",
      title: "Scraped title",
    },
  },
  {
    data: { content: 42, description: false, title: {} },
    expected: { content: "", description: "", title: "Scraped title" },
  },
])(
  "validates extracted fallback fields without replacing scraped values ($data)",
  async ({ data, expected }) => {
    mocks.scrape.mockResolvedValue({
      markdown: "",
      metadata: { description: "", title: "Scraped title" },
      success: true,
    });
    mocks.extract.mockResolvedValue({ success: true, data });
    const { retrieveUrl } = await import("./tool");
    const result = await retrieveUrl.execute(
      { url: "https://example.com/page?token=private" },
      testToolContext()
    );
    expect(result).toEqual({
      results: [{ ...expected, url: "https://example.com/page" }],
    });
    expect(mocks.extract).toHaveBeenCalledOnce();
  }
);
