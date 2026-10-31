"use client";
import { ChevronDown, ExternalLink, Globe, TextIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { retrievedInput, retrievedResult } from "./schemas";
import React from "react";
import ReactMarkdown from "react-markdown";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";

type RetrieveUrlRendererTool = ToolRendererProps<
  typeof retrievedInput,
  typeof retrievedResult
>["tool"];

const LoadingState = (): React.JSX.Element => (
  <div className="border-border bg-card my-4 rounded-xl border p-4">
    <div className="flex items-center gap-4">
      <div className="relative h-10 w-10">
        <div className="bg-primary/10 absolute inset-0 animate-pulse rounded-full" />
        <Globe className="text-primary/70 absolute inset-0 m-auto h-5 w-5" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="bg-muted-foreground/20 h-4 w-36 animate-pulse rounded-md" />
        <div className="space-y-1.5">
          <div className="bg-muted-foreground/15 h-3 w-full animate-pulse rounded-md" />
          <div className="bg-muted-foreground/15 h-3 w-2/3 animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  </div>
);

const ErrorState = ({
  errorMessage,
}: Readonly<{ errorMessage: string | undefined }>): React.JSX.Element => (
  <Alert variant="destructive" className="my-4">
    <Globe />
    <AlertTitle>Error retrieving content</AlertTitle>
    <AlertDescription>{errorMessage}</AlertDescription>
  </Alert>
);

const getItemProperty = (
  item: unknown,
  property: string,
  defaultValue: string
): string => {
  if (item !== null && typeof item === "object" && property in item) {
    const value: unknown = Reflect.get(item, property);
    return typeof value === "string" ? value : defaultValue;
  }
  return defaultValue;
};

const RetrievedContentHeader = ({
  firstItem,
}: Readonly<{ firstItem: unknown }>): React.JSX.Element => {
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
          <div className="from-primary/10 absolute inset-0 rounded-lg bg-linear-to-br to-transparent" />
          <Globe className="text-primary/70 absolute inset-0 m-auto h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-foreground truncate text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {description}
          </p>
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
              {language}
            </span>
            <a
              className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
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
};

const RetrievedContentDetails = ({
  firstItem,
}: Readonly<{ firstItem: unknown }>): React.JSX.Element => {
  const content = getItemProperty(firstItem, "content", "No content available");

  return (
    <div className="border-border border-t">
      <details className="group">
        <summary className="text-muted-foreground hover:bg-muted flex w-full cursor-pointer items-center justify-between px-4 py-2 text-sm transition-colors">
          <div className="flex items-center gap-2">
            <TextIcon className="text-muted-foreground h-4 w-4" />
            <span>View content</span>
          </div>
          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="bg-muted/50 max-h-[50vh] overflow-y-auto p-4">
          <div className="prose prose-neutral dark:prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </details>
    </div>
  );
};

const getFirstItem = (result: unknown): unknown => {
  if (
    result !== null &&
    typeof result === "object" &&
    "results" in result &&
    Array.isArray(result.results)
  ) {
    return result.results[0];
  }
  return undefined;
};

const getErrorMessage = (
  result: unknown,
  firstItem: unknown
): string | null => {
  const topLevelError =
    result !== null &&
    typeof result === "object" &&
    "error" in result &&
    typeof result.error === "string"
      ? result.error
      : undefined;
  const firstItemError =
    firstItem !== null &&
    typeof firstItem === "object" &&
    "error" in firstItem &&
    typeof firstItem.error === "string"
      ? firstItem.error
      : undefined;

  return topLevelError ?? firstItemError ?? null;
};

const RetrieveUrlView = ({
  tool,
}: ReadonlyNativeSurface<{
  tool: RetrieveUrlRendererTool;
  messageId: string;
  isReadonly: boolean;
}>): React.JSX.Element | null => {
  if (tool.state === "input-available" || tool.state === "input-streaming") {
    return <LoadingState />;
  }

  if (tool.state !== "output-available") {
    return null;
  }

  if (tool.output === undefined) {
    return null;
  }

  const { output: result } = tool;
  const firstItem = getFirstItem(result);
  const errorMessage = getErrorMessage(result, firstItem);

  if (typeof errorMessage === "string" && errorMessage !== "") {
    return <ErrorState errorMessage={errorMessage} />;
  }

  return (
    <div className="border-border bg-card my-4 overflow-hidden rounded-xl border">
      <RetrievedContentHeader firstItem={firstItem} />
      <RetrievedContentDetails firstItem={firstItem} />
    </div>
  );
};

export const RetrieveUrlRenderer = defineToolRenderer({
  inputSchema: retrievedInput,
  outputSchema: retrievedResult,
  render: RetrieveUrlView,
});
