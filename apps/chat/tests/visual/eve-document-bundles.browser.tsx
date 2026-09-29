import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { DocumentBody } from "@/components/eve/eve-document-body";
import { documentUi } from "@/tools/chatjs/document-ui";

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
    await takeSnapshot("uninstalled-document-editor");
  } finally {
    documentUi.text = original;
    await act(() => root.unmount());
    container.remove();
  }
});
