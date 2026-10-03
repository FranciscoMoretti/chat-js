"use client";

import { ChevronDown, ExternalLink, Globe, TextIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { retrievedInput, retrievedResult } from "./schemas";
/* oxlint-enable eslint/sort-imports */

type RetrieveUrlRendererTool = ToolRendererProps<
  typeof retrievedInput,
  typeof retrievedResult
>["tool"];

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
const LoadingState = () => (
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
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const ErrorState = ({ errorMessage }: { errorMessage: string | undefined }) => (
  <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500 dark:bg-red-950/50">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
        <Globe className="h-4 w-4 text-red-600 dark:text-red-300" />
      </div>
      <div>
        <div className="text-sm font-medium text-red-700 dark:text-red-300">
          Error retrieving content
        </div>
        <div className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">
          {errorMessage}
        </div>
      </div>
    </div>
  </div>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const getItemProperty = <T,>(
  item: unknown,
  property: string,
  defaultValue: T
): T => {
  if (item && typeof item === "object" && property in item) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Retrieved provider and saved document payloads may follow older shapes; preserve the existing fallback extraction until a versioned payload migration is defined.
    const value = (item as Record<string, unknown>)[property];
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Retrieved provider and saved document payloads may follow older shapes; preserve the existing fallback extraction until a versioned payload migration is defined.
    return (value as T) ?? defaultValue;
  }
  return defaultValue;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/id-length */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const RetrievedContentHeader = ({ firstItem }: { firstItem: unknown }) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const RetrievedContentDetails = ({ firstItem }: { firstItem: unknown }) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
// oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
const getFirstItem = (result: unknown): unknown => {
  if (
    result &&
    typeof result === "object" &&
    "results" in result &&
    Array.isArray(result.results)
  ) {
    return result.results[0];
  }
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const getErrorMessage = (
  result: unknown,
  firstItem: unknown
): string | null => {
  const topLevelError =
    result && typeof result === "object" && "error" in result
      ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Retrieved provider and saved document payloads may follow older shapes; preserve the existing fallback extraction until a versioned payload migration is defined.
        (result.error as string)
      : undefined;
  const firstItemError =
    firstItem && typeof firstItem === "object" && "error" in firstItem
      ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Retrieved provider and saved document payloads may follow older shapes; preserve the existing fallback extraction until a versioned payload migration is defined.
        (firstItem.error as string)
      : undefined;

  return topLevelError ?? firstItemError ?? null;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const RetrieveUrlView = ({
  tool,
}: {
  tool: RetrieveUrlRendererTool;
  messageId: string;
  isReadonly: boolean;
}) => {
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const RetrieveUrlRenderer = defineToolRenderer({
  inputSchema: retrievedInput,
  outputSchema: retrievedResult,
  render: RetrieveUrlView,
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
