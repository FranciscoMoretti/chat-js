"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, JSX as ReactJSX } from "react";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { codeToHtml } from "shiki";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { BundledLanguage, ShikiTransformer } from "shiki";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
  showLineNumbers?: boolean;
};

interface CodeBlockContextType {
  code: string;
}

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});
/* oxlint-disable typescript/prefer-readonly-parameter-types -- lineNumberTransformer: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including node). */

const lineNumberTransformer: ShikiTransformer = {
  line(node, line) {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

const highlightCode = async (
  code: string,
  language: BundledLanguage,
  showLineNumbers = false
) => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable max-lines-per-function, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- CodeBlock: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children). */

const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes code, language, showLineNumbers, className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: CodeBlockProps): ReactJSX.Element => {
  const [html, setHtml] = useState<string>("");
  const [darkHtml, setDarkHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve updateHighlightedCode's awaited sequencing and rejected-Promise behavior. */
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
            // oxlint-disable-next-line react/no-danger -- Shiki codeToHtml escapes source text and supplies the trusted syntax-highlighting markup.
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {/* Shiki returns escaped, trusted HTML for syntax highlighting. */}
          <div
            className="[&>pre]:bg-background! [&>pre]:text-foreground! hidden overflow-auto dark:block [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm"
            // oxlint-disable-next-line react/no-danger -- Shiki codeToHtml escapes source text and supplies the trusted syntax-highlighting markup.
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
/* oxlint-enable max-lines-per-function, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- CodeBlockCopyButtonProps: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including error: Error). */

type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return -- CodeBlockCopyButton: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2000); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including navigator?.clipboard?.writeText); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes onCopy, onError, timeout, children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: CodeBlockCopyButtonProps): ReactJSX.Element => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve copyToClipboard's awaited sequencing and rejected-Promise behavior. */
  const copyToClipboard = async (): Promise<void> => {
    // oxlint-disable-next-line unicorn/prefer-global-this, oxc/no-optional-chaining -- #572: This tests for a browser window; globalThis also exists during server rendering. Optional chain: Keep the existing nullish guard when reading writeText from navigator.clipboard; read clipboard from navigator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onError; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onCopy; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when calling onError; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep onError argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };
  /* oxlint-enable oxc/no-async-await */
  // oxlint-disable-next-line no-ternary -- Keep Icon as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("shrink-0", className)}

      // oxlint-disable-next-line typescript/no-misused-promises -- #585: The clipboard handler catches failures and invokes onError; the click does not consume a return value.
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CodeBlockCopyButton's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (CodeBlock, CodeBlockCopyButton, highlightCode); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */
/* oxlint-disable react/only-export-components -- #620: Consumers import CodeBlock, CodeBlockCopyButton, highlightCode from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { CodeBlock, CodeBlockCopyButton, highlightCode };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (CodeBlockCopyButtonProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/only-export-components */
export type { CodeBlockCopyButtonProps };
/* oxlint-enable import/no-named-export */
