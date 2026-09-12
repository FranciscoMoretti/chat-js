/* oxlint-disable nextjs/no-img-element -- Sandbox screenshots use dynamic image URLs. */
"use client";

import type { ToolUIPart } from "ai";
import React from "react";
import type { BundledLanguage } from "shiki";

import {
  Sandbox,
  SandboxCode,
  SandboxContent,
  SandboxHeader,
  SandboxOutput,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "@/components/ai-elements/sandbox";

interface SandboxComposedProps {
  code: string;
  language?: BundledLanguage;
  output?: string;
  state: ToolUIPart["state"];
  title?: string;
}

export const SandboxComposed = ({
  code,
  output,
  language = "tsx",
  title,
  state,
}: SandboxComposedProps) => {
  const [activeTab, setActiveTab] = React.useState("code");

  return (
    <Sandbox>
      <SandboxHeader state={state} title={title} />
      <SandboxContent>
        <SandboxTabs onValueChange={setActiveTab} value={activeTab}>
          <div className="border-border flex items-center border-b">
            <SandboxTabsList>
              <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
              <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
            </SandboxTabsList>
          </div>
          <SandboxTabContent value="code">
            <SandboxCode code={code} language={language} />
          </SandboxTabContent>
          <SandboxTabContent value="output">
            <SandboxOutput code={output ?? ""} />
          </SandboxTabContent>
        </SandboxTabs>
      </SandboxContent>
    </Sandbox>
  );
};
