"use client";

import type { BundledLanguage, ShikiTransformer } from "shiki";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, JSX as ReactJSX } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { codeToHtml } from "shiki";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
  showLineNumbers?: boolean;
};

interface CodeBlockContextType {
  code: string;
}

const COPY_BUTTON_TIMEOUT_MS = 2000;
const COPY_BUTTON_ICON_SIZE = 14;

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

const lineNumberTransformer: ShikiTransformer = {
  line(
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- The Shiki transformer prepends to node.children; retain this native AST writer contract. */
    node,
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ line
  ) {
    node.children.unshift({
      children: [{ type: "text", value: String(line) }],
      properties: {
        className: [
          "inline-block",
          "min-w-10",
          "mr-4",
          "text-right",
          "select-none",
          "text-muted-foreground",
        ],
      },
      tagName: "span",
      type: "element",
    });
  },
  name: "line-numbers",
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve highlightCode's awaited sequencing and rejected-Promise behavior. */

const highlightCode = async (
  code: string,
  language: BundledLanguage,
  showLineNumbers = false
): Promise<[string, string]> => {
  // oxlint-disable-next-line no-ternary -- Keep transformers as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const transformers: ShikiTransformer[] = showLineNumbers
    ? [lineNumberTransformer]
    : [];

  return await Promise.all([
    codeToHtml(code, {
      lang: language,
      theme: "one-light",
      transformers,
    }),
    codeToHtml(code, {
      lang: language,
      theme: "one-dark-pro",
      transformers,
    }),
  ]);
};
/* oxlint-enable oxc/no-async-await */

const useHighlightedCode = (
  code: string,
  language: BundledLanguage,
  showLineNumbers: boolean
): { readonly html: string; readonly darkHtml: string } => {
  const [html, setHtml] = useState<string>("");
  const [darkHtml, setDarkHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    /* oxlint-disable oxc/no-async-await -- The configured promise/prefer-await-to-then rule rejects a Promise continuation; retain this awaited highlight lifecycle and rejection propagation. */
    const updateHighlightedCode = async (): Promise<void> => {
      const [light, dark] = await highlightCode(
        code,
        language,
        showLineNumbers
      );
      if (!cancelled) {
        setHtml(light);
        setDarkHtml(dark);
      }
    };
    /* oxlint-enable oxc/no-async-await */
    void updateHighlightedCode();

    return (): void => {
      cancelled = true;
    };
  }, [code, language, showLineNumbers]);

  return { darkHtml, html };
};

/* oxlint-disable react/jsx-max-depth, typescript/strict-boolean-expressions -- CodeBlock: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children). */

const CodeBlock = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    code,
    language,
    showLineNumbers = false,
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes code, language, showLineNumbers, className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: CodeBlockProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const { html, darkHtml } = useHighlightedCode(
    code,
    language,
    showLineNumbers
  );

  const contextValue = useMemo(() => ({ code }), [code]);

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <div
        className={cn(
          "group bg-background text-foreground relative w-full overflow-hidden rounded-md border",
          className
        )}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CodeBlock's native div attributes, preserving caller events and accessibility props.
        {...props}
      >
        <div className="relative">
          {/* Shiki returns escaped, trusted HTML for syntax highlighting. */}
          <div
            className="[&>pre]:bg-background! [&>pre]:text-foreground! overflow-auto dark:hidden [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm"
            // oxlint-disable-next-line react/no-danger -- codeToHtml escapes source; line labels are numeric text in static spans.
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {/* Shiki returns escaped, trusted HTML for syntax highlighting. */}
          <div
            className="[&>pre]:bg-background! [&>pre]:text-foreground! hidden overflow-auto dark:block [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm"
            // oxlint-disable-next-line react/no-danger -- codeToHtml escapes source; line labels are numeric text in static spans.
            dangerouslySetInnerHTML={{ __html: darkHtml }}
          />
          {children && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};
/* oxlint-enable react/jsx-max-depth, typescript/strict-boolean-expressions */

type CodeBlockCopyButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onCopy" | "onError"
> & {
  readonly onCopy?: () => void | Promise<void>;
  readonly onError?: (error: Readonly<Error>) => void | Promise<void>;
  timeout?: number;
};

const useCopyCode = (
  code: string,
  {
    timeout,
    onCopy,
    onError,
  }: Readonly<
    Pick<CodeBlockCopyButtonProps, "onCopy" | "onError"> & { timeout: number }
  >
): { readonly isCopied: boolean; readonly handleClick: () => void } => {
  const [isCopied, setIsCopied] = useState(false);
  const [, startCopyTransition] = useTransition();

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve copyToClipboard's awaited sequencing and rejected-Promise behavior. */
  const copyToClipboard = useCallback(async (): Promise<void> => {
    /* oxlint-disable unicorn/prefer-global-this, oxc/no-optional-chaining -- typeof window supports the unbound SSR global; globalThis.window's equivalent typeof check conflicts with unicorn/no-typeof-undefined. Native browser Clipboard can be absent in insecure contexts. */
    if (
      typeof window === "undefined" ||
      typeof navigator?.clipboard?.writeText !== "function"
    ) {
      await (typeof onError === "function" &&
        onError(new Error("Clipboard API not available")));
      return;
    }
    /* oxlint-enable unicorn/prefer-global-this, oxc/no-optional-chaining */

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), timeout);
      await (typeof onCopy === "function" && onCopy());
    } catch (error) {
      await (typeof onError === "function" &&
        onError(
          // oxlint-disable-next-line no-ternary -- The native clipboard callback needs a lazy Error normalization only when an error handler exists.
          error instanceof Error ? error : new Error(String(error))
        ));
    }
  }, [code, onCopy, onError, timeout]);
  /* oxlint-enable oxc/no-async-await */

  const handleClick = useCallback((): void => {
    startCopyTransition(copyToClipboard);
  }, [copyToClipboard, startCopyTransition]);
  return { handleClick, isCopied };
};

/* oxlint-disable react/no-multi-comp -- CodeBlockCopyButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const CodeBlockCopyButton = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    onCopy,
    onError,
    timeout = COPY_BUTTON_TIMEOUT_MS,
    children,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes onCopy, onError, timeout, children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: CodeBlockCopyButtonProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const { code } = useContext(CodeBlockContext);
  const { isCopied, handleClick } = useCopyCode(code, {
    onCopy,
    onError,
    timeout,
  });
  // oxlint-disable-next-line no-ternary -- Keep Icon as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("shrink-0", className)}
      onClick={handleClick}
      size="icon"
      variant="ghost"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CodeBlockCopyButton's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? <Icon size={COPY_BUTTON_ICON_SIZE} />}
    </Button>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (CodeBlock, CodeBlockCopyButton, highlightCode); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */
/* oxlint-disable react/only-export-components -- #620: Consumers import CodeBlock, CodeBlockCopyButton, highlightCode from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { CodeBlock, CodeBlockCopyButton, highlightCode };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (CodeBlockCopyButtonProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/only-export-components */
export type { CodeBlockCopyButtonProps };
/* oxlint-enable import/no-named-export */
