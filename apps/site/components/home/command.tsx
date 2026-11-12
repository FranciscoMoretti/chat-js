"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const command = "npx chat-js@alpha create my-app";

export const CreateCommand = () => {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const code = useRef<HTMLElement>(null);
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
    <div className="hero-cli">
      <span className="eyebrow">Or start in your terminal</span>
      <div className="cli-command">
        <span className="prompt" aria-hidden="true">
          $
        </span>
        <code ref={code}>{command}</code>
        <button
          type="button"
          className="copy-command"
          onClick={() => {
            void copy();
          }}
          aria-label="Copy create command"
        >
          {status === "Command copied." ? (
            <Check size={15} />
          ) : (
            <Copy size={15} />
          )}
          <span>{status === "Command copied." ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <output className="sr-only" aria-live="polite">
        {status}
      </output>
    </div>
  );
};
