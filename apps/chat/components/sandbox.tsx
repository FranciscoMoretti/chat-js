"use client";

import React from "react";
import type { ToolUIPart } from "ai";
import type { BundledLanguage } from "shiki";
import { CodeIcon } from "lucide-react";
import { ToolActivity } from "@/components/part/tool-activity";
import { CodeSnippet } from "@/components/code-snippet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const SandboxComposed = ({
  code,
  output,
  language = "tsx",
  title,
  state,
}: {
  readonly code: string;
  readonly language?: BundledLanguage;
  readonly output?: string;
  readonly state: ToolUIPart["state"];
  readonly title?: string;
}): React.JSX.Element => (
  <ToolActivity
    title={title ?? "Code execution"}
    state={state}
    icon={<CodeIcon />}
    defaultOpen
  >
    <Tabs defaultValue="code">
      <TabsList>
        <TabsTrigger value="code">Code</TabsTrigger>
        <TabsTrigger value="output">Output</TabsTrigger>
      </TabsList>
      <TabsContent value="code">
        <CodeSnippet code={code} language={language} />
      </TabsContent>
      <TabsContent value="output">
        <CodeSnippet code={output ?? ""} language="ansi" />
      </TabsContent>
    </Tabs>
  </ToolActivity>
);
