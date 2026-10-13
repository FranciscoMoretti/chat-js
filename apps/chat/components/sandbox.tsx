"use client";

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

import type { BundledLanguage } from "shiki";

import React from "react";

import type { ToolUIPart } from "ai";

interface SandboxComposedProps {
  readonly code: string;
  readonly language?: BundledLanguage;
  readonly output?: string;
  readonly state: ToolUIPart["state"];
  readonly title?: string;
}

export const SandboxComposed = ({
  code,
  output,
  language = "tsx",
  title,
  state,
}: SandboxComposedProps): React.JSX.Element => {
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
