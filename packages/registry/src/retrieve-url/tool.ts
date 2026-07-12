import FirecrawlApp from "@mendable/firecrawl-js";
import { tool } from "ai";
import { z } from "zod";
import {
  defineTool,
  type ToolRuntimeContext,
} from "@toolkit/lib/runtime";

type ToolEnvVars = {
  description?: string;
  options: string[][];
}[];

const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const FIRECRAWL_TIMEOUT_MS = 30_000;

export const toolEnvVars: ToolEnvVars = [
  {
    description: "FIRECRAWL_API_KEY",
    options: [["FIRECRAWL_API_KEY"]],
  },
];

function parseUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function displayUrl(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

function getErrorName(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error;
  }
  return SAFE_ERROR_NAME.test(error.name) ? error.name : "Error";
}

function getAbortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ?? new DOMException("The operation was aborted", "AbortError")
  );
}

export function withAbortSignal<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = FIRECRAWL_TIMEOUT_MS
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () =>
      finish(() => reject(getAbortReason(signal as AbortSignal)));
    const timeoutId = setTimeout(
      () =>
        finish(() =>
          reject(
            new Error(`Firecrawl operation timed out after ${timeoutMs}ms`)
          )
        ),
      timeoutMs
    );

    signal?.addEventListener("abort", handleAbort, { once: true });
    Promise.resolve()
      .then(() => {
        if (signal?.aborted) {
          throw getAbortReason(signal);
        }
        return operation();
      })
      .then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error))
      );
  });
}

export const retrieveUrl = defineTool({
  id: "retrieve-url",
  needs: ["env.read", "url.retrieve"],
  createTool: (ctx: ToolRuntimeContext) => {
    const app = ctx.env.get("FIRECRAWL_API_KEY")
      ? new FirecrawlApp({ apiKey: ctx.env.require("FIRECRAWL_API_KEY") })
      : null;

    return tool({
      description: `Fetch structured information from a single URL via Firecrawl.

Use for:
- Extract content from a specific URL supplied by the user

Avoid:
- General-purpose web searches`,
      inputSchema: z.object({
        url: z.string().describe("The URL to retrieve the information from."),
      }),
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Retrieval fallbacks are kept together to preserve the provider response flow.
      execute: async ({ url }: { url: string }, { abortSignal }) => {
        try {
          if (!app) {
            return {
              error:
                "Firecrawl is not configured. Set FIRECRAWL_API_KEY to enable retrieval.",
            };
          }
          const parsedUrl = parseUrl(url);
          if (!parsedUrl) {
            return {
              error: "Please provide a valid http:// or https:// URL.",
            };
          }

          const resultUrl = displayUrl(parsedUrl);
          const normalizedUrl = parsedUrl.toString();
          const content = await withAbortSignal(
            () =>
              app.scrapeUrl(normalizedUrl, {
                timeout: FIRECRAWL_TIMEOUT_MS,
              }),
            abortSignal
          );
          if (!(content.success && content.metadata)) {
            return {
              results: [
                {
                  error:
                    content.error ?? "Failed to retrieve content from the URL.",
                },
              ],
            };
          }

          const schema = z.object({
            title: z.string(),
            content: z.string(),
            description: z.string(),
          });

          let title = content.metadata.title;
          let description = content.metadata.description;
          let extractedContent = content.markdown;

          if (!(title && description && extractedContent)) {
            const extractResult = await withAbortSignal(
              () =>
                app.extract([normalizedUrl], {
                  prompt:
                    "Extract the page title, main content, and a brief description.",
                  schema,
                  scrapeOptions: { timeout: FIRECRAWL_TIMEOUT_MS },
                }),
              abortSignal
            );

            if (extractResult.success && extractResult.data) {
              title = title || extractResult.data.title;
              description = description || extractResult.data.description;
              extractedContent = extractedContent || extractResult.data.content;
            }
          }

          return {
            results: [
              {
                title: title || "Untitled",
                content: extractedContent || "",
                url: resultUrl,
                description: description || "",
                language: content.metadata.language,
              },
            ],
          };
        } catch (error) {
          if (abortSignal?.aborted) {
            throw getAbortReason(abortSignal);
          }
          const failedUrl = parseUrl(url);
          console.error("retrieveUrl failed", {
            errorName: getErrorName(error),
            url: failedUrl ? displayUrl(failedUrl) : "invalid",
          });
          return { error: "Failed to retrieve content" };
        }
      },
    });
  },
} as const);
