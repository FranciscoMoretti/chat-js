import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Test-only route in a disposable generated app. These imports resolve against
// installed source/dependencies, never the monorepo or a hand-built UI double.
export const installActivityFixture = async (app: string) => {
  const directory = path.join(app, "app/native-ui-check");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "page.tsx"),
    `"use client";
import { ToolActivity } from "@/components/part/tool-activity";
import { ToolOutput } from "@/components/part/tool-data";
import { CodeSnippet } from "@/components/code-snippet";
const states = ["input-streaming", "input-available", "approval-requested", "approval-responded", "output-available", "output-denied", "output-error"] as const;
export default function NativeActivityFixture() {
  return <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
    <h1>Generated activity verification</h1>
    {states.map(state => <ToolActivity key={state} title={state} state={state} defaultOpen>
      <ToolOutput output={0} errorText={state === "output-error" ? "Sample tool failure" : undefined} />
    </ToolActivity>)}
    <CodeSnippet code={'const result = 42;\\n'} language="typescript" lineNumbers />
  </main>;
}
`
  );
};
