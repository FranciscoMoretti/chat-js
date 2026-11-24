"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  CodeBlock,
  CodeBlockContent,
} from "@/components/create-preview/ui/base/code-block";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";

const command = "npx chat-js@alpha create";

export const CreateCommand = () => {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const code = useRef<HTMLPreElement>(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current ?? undefined);
    },
    []
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("Command copied.");
    } catch {
      if (code.current) {
        const range = document.createRange();
        range.selectNodeContents(code.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setStatus("Select and copy the command with your keyboard.");
    }
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => {
      setStatus("");
    }, 2400);
  };

  return (
    <div className="canopy-terminal">
      <CodeBlock
        size="sm"
        className="canopy-command"
        aria-label="Terminal quickstart"
      >
        <Terminal size={15} aria-hidden="true" />
        <CodeBlockContent ref={code} tabIndex={-1}>
          {command}
        </CodeBlockContent>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Copy quickstart command"
          onClick={() => {
            void copy();
          }}
        >
          {status === "Command copied." ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
        </Button>
      </CodeBlock>
      <output className="sr-only" aria-live="polite">
        {status}
      </output>
    </div>
  );
};
