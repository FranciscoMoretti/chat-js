import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { DocumentBody } from "@/components/eve/eve-document-body";
import { documentUi } from "@/tools/chatjs/document-ui";
import { installedToolNames } from "@/tools/chatjs/installed-features";
import { EveDocumentRun } from "@/tools/chatjs/saved-code-execution/document";

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
    await act(() =>
      root.render(
        <div className="grid gap-6">
          {documents.map(({ kind, title, content }) => (
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
      )
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
    await takeSnapshot("installed-document-bundles");
  } finally {
    await act(() => root.unmount());
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
    await act(() =>
      root.render(
        <div>
          {[false, true].map((inline) => (
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
      )
    );
    expect(container.querySelectorAll("output")).toHaveLength(2);
    expect(container.textContent).toContain("Install text-documents");
    expect(
      [...container.querySelectorAll("pre")].map(
        (element) => element.textContent
      )
    ).toEqual(["Saved content", "Saved content"]);
    await takeSnapshot("uninstalled-document-editor");
  } finally {
    documentUi.text = original;
    await act(() => root.unmount());
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
  const onAction = vi.fn();
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
    await act(() =>
      root.render(
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
      )
    );
    await expect
      .element(page.getByRole("button", { exact: true, name: "Run" }).nth(0))
      .toBeEnabled();
    await expect
      .element(page.getByRole("button", { exact: true, name: "Run" }).nth(1))
      .toBeDisabled();
    await takeSnapshot("saved-code-installed-run-controls");
    await act(() =>
      page.getByRole("button", { exact: true, name: "Run" }).nth(0).click()
    );
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(props.revisionId),
      })
    );
    installed.delete("runCodeDocument");
    await act(() =>
      root.render(
        <section>
          <h2>Execution absent</h2>
          <EveDocumentRun {...props} />
        </section>
      )
    );
    await expect
      .element(page.getByRole("button", { exact: true, name: "Run" }))
      .not.toBeInTheDocument();
    await takeSnapshot("saved-code-absent-run-controls");
  } finally {
    vi.restoreAllMocks();
    await act(() => root.unmount());
    container.remove();
  }
});
