"use client";

import { ChevronDown, ExternalLink, Globe, TextIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { TypelessToolPartFromTool } from "@toolkit/lib/tool-part";
import type { retrieveUrl } from "./tool";

type RetrieveUrlRendererTool = TypelessToolPartFromTool<
  ReturnType<typeof retrieveUrl.createTool>
>;

function LoadingState() {
  return (
    <div className="my-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10" />
          <Globe className="absolute inset-0 m-auto h-5 w-5 text-primary/70" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 animate-pulse rounded-md bg-muted-foreground/20" />
          <div className="space-y-1.5">
            <div className="h-3 w-full animate-pulse rounded-md bg-muted-foreground/15" />
            <div className="h-3 w-2/3 animate-pulse rounded-md bg-muted-foreground/15" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ errorMessage }: { errorMessage: string | undefined }) {
  return (
    <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500 dark:bg-red-950/50">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
          <Globe className="h-4 w-4 text-red-600 dark:text-red-300" />
        </div>
        <div>
          <div className="font-medium text-red-700 text-sm dark:text-red-300">
            Error retrieving content
          </div>
          <div className="mt-1 text-red-600/80 text-xs dark:text-red-400/80">
            {errorMessage}
          </div>
        </div>
      </div>
    </div>
  );
}

function getItemProperty<T>(
  item: unknown,
  property: string,
  defaultValue: T
): T {
  if (item && typeof item === "object" && property in item) {
    const value = (item as Record<string, unknown>)[property];
    return (value as T) ?? defaultValue;
  }
  return defaultValue;
}

function RetrievedContentHeader({ firstItem }: { firstItem: unknown }) {
  const url = getItemProperty(firstItem, "url", "");
  const title = getItemProperty(firstItem, "title", "Retrieved Content");
  const description = getItemProperty(
    firstItem,
    "description",
    "No description available"
  );
  const language = getItemProperty(firstItem, "language", "Unknown");

  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-10 w-10 shrink-0">
          <div className="absolute inset-0 rounded-lg bg-linear-to-br from-primary/10 to-transparent" />
          <Globe className="absolute inset-0 m-auto h-5 w-5 text-primary/70" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="truncate font-semibold text-foreground text-lg tracking-tight">
            {title}
          </h2>
          <p className="line-clamp-2 text-muted-foreground text-sm">
            {description}
          </p>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
              {language}
            </span>
            <a
              className="inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-primary"
              href={url || "#"}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-3 w-3" />
              View source
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function RetrievedContentDetails({ firstItem }: { firstItem: unknown }) {
  const content = getItemProperty(firstItem, "content", "No content available");

  return (
    <div className="border-border border-t">
      <details className="group">
        <summary className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted">
          <div className="flex items-center gap-2">
            <TextIcon className="h-4 w-4 text-muted-foreground" />
            <span>View content</span>
          </div>
          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="max-h-[50vh] overflow-y-auto bg-muted/50 p-4">
          <div className="prose prose-neutral dark:prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </details>
    </div>
  );
}

function getFirstItem(result: unknown): unknown {
  if (
    result &&
    typeof result === "object" &&
    "results" in result &&
    Array.isArray(result.results)
  ) {
    return result.results[0];
  }
}

function getErrorMessage(result: unknown, firstItem: unknown): string | null {
  const topLevelError =
    result && typeof result === "object" && "error" in result
      ? (result.error as string)
      : undefined;
  const firstItemError =
    firstItem && typeof firstItem === "object" && "error" in firstItem
      ? (firstItem.error as string)
      : undefined;

  return topLevelError ?? firstItemError ?? null;
}

export function RetrieveUrlRenderer({
  tool,
}: {
  tool: RetrieveUrlRendererTool;
  messageId: string;
  isReadonly: boolean;
}) {
  if (tool.state === "input-available" || tool.state === "input-streaming") {
    return <LoadingState />;
  }

  if (tool.state !== "output-available") {
    return null;
  }

  if (!tool.output) {
    return null;
  }

  const { output: result } = tool;
  const firstItem = getFirstItem(result);
  const errorMessage = getErrorMessage(result, firstItem);

  if (errorMessage) {
    return <ErrorState errorMessage={errorMessage} />;
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-card">
      <RetrievedContentHeader firstItem={firstItem} />
      <RetrievedContentDetails firstItem={firstItem} />
    </div>
  );
}
