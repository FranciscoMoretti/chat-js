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
/* oxlint-disable react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- SandboxComposed: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
