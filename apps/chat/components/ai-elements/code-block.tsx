"use client";

import { hasCustomContent } from "@/components/custom-content";

import type { BundledLanguage, TokensResult, ThemedToken } from "shiki";
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
import { codeToTokens, getTokenStyleObject } from "shiki";

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

const highlightCode = async (
  code: string,
  language: BundledLanguage
): Promise<[TokensResult, TokensResult]> =>
  await Promise.all([
    codeToTokens(code, {
      lang: language,
      theme: "one-light",
    }),
    codeToTokens(code, {
      lang: language,
      theme: "one-dark-pro",
    }),
  ]);

const useHighlightedCode = (
  code: string,
  language: BundledLanguage
): { readonly light?: TokensResult; readonly dark?: TokensResult } => {
  const [highlighted, setHighlighted] = useState<{
    light: TokensResult;
    dark: TokensResult;
  }>();

  useEffect(() => {
    let cancelled = false;
    const updateHighlightedCode = async (): Promise<void> => {
      const [light, dark] = await highlightCode(code, language);
      if (!cancelled) {
        setHighlighted({ light, dark });
      }
    };
    void updateHighlightedCode();

    return (): void => {
      cancelled = true;
    };
  }, [code, language]);

  return highlighted ?? {};
};

const tokenStyle = (token: ThemedToken): React.CSSProperties => {
  const style = getTokenStyleObject(token);
  return {
    color: style.color,
    backgroundColor: style["background-color"],
    fontStyle: style["font-style"] === "italic" ? "italic" : undefined,
    fontWeight: style["font-weight"] === "bold" ? "bold" : undefined,
    textDecoration: style["text-decoration"],
  };
};

const HighlightedCode = ({
  result,
  showLineNumbers,
}: {
  readonly result: TokensResult | undefined;
  readonly showLineNumbers: boolean;
}): React.JSX.Element | null => {
  if (result === undefined) {
    return null;
  }
  return (
    <pre
      className={`shiki ${result.themeName ?? ""}`}
      style={{ backgroundColor: result.bg, color: result.fg }}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Preserve Shiki's focusable pre so keyboard users can scroll overflowing source without a pointer.
      tabIndex={0}
      aria-label="Code"
    >
      <code>
        {result.tokens.map((line, index) => (
          <React.Fragment key={index}>
            <span className="line">
              {showLineNumbers && (
                <span className="text-muted-foreground mr-4 inline-block min-w-10 text-right select-none">
                  {index + 1}
                </span>
              )}
              {line.map((token) => (
                <span key={token.offset} style={tokenStyle(token)}>
                  {token.content}
                </span>
              ))}
            </span>
            {index < result.tokens.length - 1 ? "\n" : null}
          </React.Fragment>
        ))}
      </code>
    </pre>
  );
};

const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps): ReactJSX.Element => {
  const { light, dark } = useHighlightedCode(code, language);

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
          <div className="[&>pre]:bg-background! [&>pre]:text-foreground! overflow-auto dark:hidden [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm">
            <HighlightedCode result={light} showLineNumbers={showLineNumbers} />
          </div>
          <div className="[&>pre]:bg-background! [&>pre]:text-foreground! hidden overflow-auto dark:block [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm">
            <HighlightedCode result={dark} showLineNumbers={showLineNumbers} />
          </div>
          {hasCustomContent(children) ? (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};

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

  const copyToClipboard = useCallback(async (): Promise<void> => {
    if (
      typeof window === "undefined" ||
      typeof navigator?.clipboard?.writeText !== "function"
    ) {
      await (typeof onError === "function" &&
        onError(new Error("Clipboard API not available")));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, timeout);
      await (typeof onCopy === "function" && onCopy());
    } catch (error) {
      await (typeof onError === "function" &&
        onError(error instanceof Error ? error : new Error(String(error))));
    }
  }, [code, onCopy, onError, timeout]);

  const handleClick = useCallback((): void => {
    startCopyTransition(copyToClipboard);
  }, [copyToClipboard, startCopyTransition]);
  return { handleClick, isCopied };
};

const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = COPY_BUTTON_TIMEOUT_MS,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps): ReactJSX.Element => {
  const { code } = useContext(CodeBlockContext);
  const { isCopied, handleClick } = useCopyCode(code, {
    onCopy,
    onError,
    timeout,
  });
  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={handleClick}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={COPY_BUTTON_ICON_SIZE} />}
    </Button>
  );
};
export { CodeBlock, CodeBlockCopyButton, highlightCode };
export type { CodeBlockCopyButtonProps };
