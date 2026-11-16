"use client";
import { CodeSnippet } from "@/components/code-snippet";
import type { z } from "zod";
import type { bashResultSchema } from "@/lib/eve/bash-result";

export const BashOutput = ({
  output,
}: {
  readonly output: z.infer<typeof bashResultSchema>;
}) => (
  <div className="min-w-0 space-y-2 text-sm">
    <CodeSnippet code={output.stdout || "(no output)"} language="text" />
    {output.stderr !== "" && (
      <div className="text-destructive">
        <p className="mb-1 text-xs">Standard error</p>
        <CodeSnippet code={output.stderr} language="text" />
      </div>
    )}
    {output.status === "completed" ? (
      <p className="text-muted-foreground text-xs">
        Exit code: {output.exitCode}
      </p>
    ) : (
      <div className="text-muted-foreground text-xs">
        <p>Running in background · PID {output.pid}</p>
        <p className="break-all">Output: {output.outputDirectory}</p>
      </div>
    )}
    {output.truncated && (
      <p className="text-muted-foreground text-xs">Output truncated by EVE.</p>
    )}
  </div>
);
