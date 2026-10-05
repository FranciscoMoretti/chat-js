import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */
import { page } from "vitest/browser";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DocumentBody } from "@/components/eve/eve-document-body";
/* oxlint-enable sort-imports */
import { documentUi } from "@/tools/chatjs/document-ui";
import { installedToolNames } from "@/tools/chatjs/installed-features";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveDocumentRun } from "@/tools/chatjs/saved-code-execution/document";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import "./sandbox.css";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- eve-document-bundles.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

vi.mock("@/tools/chatjs/text-documents/comparison", () => ({
  EveDocumentComparison: () => null,
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- eve-document-bundles.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
/* oxlint-enable typescript/explicit-function-return-type */

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
/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- editorProps: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const editorProps = {
  currentVersionIndex: 0,
  isCurrentVersion: true,
  isReadonly: true,
  onSaveContent: () => null,
  status: "idle" as const,
};
/* oxlint-disable react/jsx-no-literals -- render fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */
/* oxlint-disable max-statements, react-perf/jsx-no-new-object-as-prop -- eve-document-bundles.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership */

test("installed text, code and sheet bundles render saved content", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:980px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() =>
      root.render(
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  }
});
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, react-perf/jsx-no-new-object-as-prop */

/* oxlint-disable max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types -- eve-document-bundles.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including element). */

test("a removed editor has an explicit notice in panel and inline views", async () => {
  const original = documentUi.text;
  delete documentUi.text;
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:980px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() =>
      root.render(
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  }
});
/* oxlint-disable react/jsx-no-literals -- render fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-props-no-spreading, typescript/promise-function-async -- eve-document-bundles.browser route: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
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
    expect(
      container.querySelectorAll("section")[2]?.querySelector("button")
    ).toBeNull();
    await takeSnapshot("saved-code-installed-run-controls");
    await act(() =>
      page.getByRole("button", { exact: true, name: "Run" }).nth(0).click()
    );
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- Vitest asymmetric string matchers intentionally occupy the expected save-result message field.
        message: expect.stringContaining(props.revisionId),
      })
    );
    installed.delete("runCodeDocument");
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  }
});
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-props-no-spreading, typescript/promise-function-async */
