import { z } from "zod";
import { composeDocumentViews } from "@/lib/eve/compose-document-views";
import { renderRoot, unmountRoot } from "./primitive-mount";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { DocumentBody } from "@/components/eve/eve-document-body";
import { documents as documentUi } from "@/integrations/document-ui";
import { installedToolNames } from "@/integrations/tool-catalog";
import { EveDocumentRun } from "@/tools/chatjs/saved-code-execution/document";
import type { DocumentAssistantRequest } from "@/lib/eve/document-contracts";

import "./sandbox.css";

vi.mock("@/tools/chatjs/text-documents/comparison", () => ({
  EveDocumentComparison: () => null,
}));

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));

const documents = [
  {
    content: "# Installed text editor\n\nA saved research note.",
    kind: "text",
    title: "Notes",
  },
  {
    content: 'print("Installed code editor")',
    kind: "code",
    title: "analysis.py",
  },
  {
    content: "Product,Count\nApples,3\nOranges,5",
    kind: "sheet",
    title: "Inventory",
  },
] as const;

const editorProps = {
  currentVersionIndex: 0,
  isCurrentVersion: true,
  isReadonly: true,
  onSaveContent: () => null,
  status: "idle" as const,
};

test("installed text, code and sheet bundles render saved content", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:980px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await renderRoot(
      root,
      <div className="grid gap-6">
        {documents.map(({ kind, title, content }): React.JSX.Element => (
          <section
            className="flex h-60 flex-col overflow-hidden rounded border"
            key={kind}
          >
            <h2>{kind} document</h2>
            <DocumentBody
              kind={kind}
              title={title}
              editorProps={{ ...editorProps, content }}
            />
          </section>
        ))}
      </div>
    );
    await expect
      .poll(() => container.textContent)
      .toContain("A saved research note.");
    await expect
      .poll(() => container.querySelector(".cm-content")?.textContent)
      .toContain("Installed code editor");
    await expect
      .poll(() => container.querySelector('[role="grid"]')?.textContent)
      .toContain("Apples");
    // Lexical imports nonempty content before its placeholder state settles.
    await expect
      .poll(() => container.textContent)
      .not.toContain("Start typing...");
    await takeSnapshot("installed-document-bundles");
    await page.elementLocator(document.body).screenshot();
  } finally {
    await unmountRoot(root);
    container.remove();
  }
});

test("a removed editor has an explicit notice in panel and inline views", async () => {
  const original = documentUi.text;
  delete documentUi.text;
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:980px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await renderRoot(
      root,
      <div>
        {[false, true].map((inline): React.JSX.Element => (
          <section key={String(inline)}>
            <h2>{inline ? "Inline preview" : "Document panel"}</h2>
            <DocumentBody
              kind="text"
              title="Notes"
              inline={inline}
              editorProps={{ ...editorProps, content: "Saved content" }}
            />
          </section>
        ))}
      </div>
    );
    expect(container.querySelectorAll("output")).toHaveLength(2);
    expect(container.textContent).toContain("Your saved content is preserved.");
    expect(
      [...container.querySelectorAll("pre")].map(
        (element: { readonly textContent: string }) => element.textContent
      )
    ).toEqual(["Saved content", "Saved content"]);
    await takeSnapshot("uninstalled-document-editor");
  } finally {
    documentUi.text = original;

    await unmountRoot(root);
    container.remove();
  }
});

test("saved code run controls follow installed execution and retain disabled states", async () => {
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:980px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  const installed = new Set(installedToolNames);
  vi.spyOn(installedToolNames, "has").mockImplementation((name) =>
    installed.has(name)
  );
  const onAction = vi.fn<(request: DocumentAssistantRequest) => void>();
  const props = {
    disabled: false,
    documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
    kind: "code" as const,
    messages: [],
    onAction,
    revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
    title: "saved.js",
  };
  try {
    await renderRoot(
      root,
      <div className="grid gap-6">
        <section>
          <h2>Installed execution</h2>
          <EveDocumentRun {...props} />
        </section>
        <section>
          <h2>Unsaved changes</h2>
          <EveDocumentRun {...props} disabled />
        </section>
        <section>
          <h2>Read only</h2>
          <EveDocumentRun {...props} onAction={undefined} />
        </section>
      </div>
    );
    await expect
      .element(page.getByRole("button", { exact: true, name: "Run" }).nth(0))
      .toBeEnabled();
    await expect
      .element(page.getByRole("button", { exact: true, name: "Run" }).nth(1))
      .toBeDisabled();
    expect(
      container.querySelectorAll("section")[2]?.querySelector("button")
    ).toBeNull();
    await takeSnapshot("saved-code-installed-run-controls");
    await act(async () => {
      await page
        .getByRole("button", { exact: true, name: "Run" })
        .nth(0)
        .click();
    });
    const expectedMessage: unknown = expect.stringContaining(props.revisionId);
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expectedMessage,
      })
    );
    installed.delete("runCodeDocument");

    await renderRoot(
      root,
      <section>
        <h2>Execution absent</h2>
        <EveDocumentRun {...props} />
      </section>
    );
    await expect
      .element(page.getByRole("button", { exact: true, name: "Run" }))
      .not.toBeInTheDocument();
    await takeSnapshot("saved-code-absent-run-controls");
  } finally {
    vi.restoreAllMocks();

    await unmountRoot(root);
    container.remove();
  }
});

test("a fourth document kind renders, preserves content after removal and restores its editor", async () => {
  const definition = {
    kind: "diagram",
    contentSchema: z.string(),
    createTool: "drawDiagram",
    editTool: "reviseDiagram",
  };
  const { diagram } = composeDocumentViews([
    {
      definition,
      Body: ({ editorProps: props }) => (
        <textarea
          aria-label="Diagram source"
          readOnly={props.isReadonly}
          value={props.content}
          onChange={(event) => {
            props.onSaveContent(event.target.value, false);
          }}
        />
      ),
    },
  ]);
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:980px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  const save = vi.fn<(content: string, debounce: boolean) => void>();
  const content = "graph TD; A-->B";
  const view = (
    <DocumentBody
      kind="diagram"
      title="Flow"
      editorProps={{
        ...editorProps,
        isReadonly: false,
        content,
        onSaveContent: save,
      }}
    />
  );
  try {
    documentUi.diagram = diagram;
    await renderRoot(root, view);
    const input = container.querySelector("textarea");
    expect(input?.value).toBe(content);
    expect(input?.readOnly).toBe(false);
    delete documentUi.diagram;
    await renderRoot(root, <section>{view}</section>);
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).toContain(content);
    expect(container.textContent).toContain("Reinstall its document plugin");
    await takeSnapshot("removed-custom-document-preserves-source");
    documentUi.diagram = diagram;
    await renderRoot(root, view);
    expect(container.querySelector("textarea")?.value).toBe(content);
    expect(save).not.toHaveBeenCalled();
  } finally {
    delete documentUi.diagram;
    await unmountRoot(root);
    container.remove();
  }
});
