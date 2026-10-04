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
/* oxlint-disable react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
