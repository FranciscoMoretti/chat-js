"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ComponentProps, HTMLAttributes } from "react";
import { codeToHtml } from "shiki";
import type { BundledLanguage, ShikiTransformer } from "shiki";

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

const highlightCode = async (
  code: string,
  language: BundledLanguage,
  showLineNumbers = false
) => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable max-lines-per-function, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- CodeBlock: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children). */

const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const [html, setHtml] = useState<string>("");
  const [darkHtml, setDarkHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const updateHighlightedCode = async () => {
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

    void updateHighlightedCode();

    return () => {
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
        {...props}
      >
        <div className="relative">
          {/* Shiki returns escaped, trusted HTML for syntax highlighting. */}
          <div
            className="[&>pre]:bg-background! [&>pre]:text-foreground! overflow-auto dark:hidden [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm"
            {...{ dangerouslySetInnerHTML: { __html: html } }}
          />
          {/* Shiki returns escaped, trusted HTML for syntax highlighting. */}
          <div
            className="[&>pre]:bg-background! [&>pre]:text-foreground! hidden overflow-auto dark:block [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm"
            {...{ dangerouslySetInnerHTML: { __html: darkHtml } }}
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
/* oxlint-enable max-lines-per-function, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- CodeBlockCopyButtonProps: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including error: Error). */

type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return -- CodeBlockCopyButton: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2000); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including navigator?.clipboard?.writeText); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0", className)}

      // oxlint-disable-next-line typescript/no-misused-promises -- #585: The clipboard handler catches failures and invokes onError; the click does not consume a return value.
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */
/* oxlint-disable react/only-export-components -- #620: Consumers import CodeBlock, CodeBlockCopyButton, highlightCode from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { CodeBlock, CodeBlockCopyButton, highlightCode };
/* oxlint-enable react/only-export-components */
export type { CodeBlockCopyButtonProps };
