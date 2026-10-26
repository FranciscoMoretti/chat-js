"use client";

import React from "react";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockLine,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";

export const CodeSnippet = ({
  code,
  language,
  lineNumbers = false,
}: {
  readonly code: string;
  readonly language: string;
  readonly lineNumbers?: boolean;
}): React.JSX.Element => {
  const lines = useHighlightedCode(code, language);
  return (
    <CodeBlock>
      <CodeBlockActions>
        <CodeBlockCopyButton value={code} />
      </CodeBlockActions>
      <CodeBlockContent lineNumbers={lineNumbers}>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
};
