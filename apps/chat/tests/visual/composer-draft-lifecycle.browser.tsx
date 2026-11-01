import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { useEveComposerDraft } from "@/components/eve/use-eve-composer-draft";
import { createDomHarness } from "@/components/test-dom-harness";

const Draft = ({ scope }: { readonly scope: string }): React.JSX.Element => {
  const draft = useEveComposerDraft("owner", scope);
  return (
    <section>
      <output aria-label="Draft">{draft.text}</output>
      <output aria-label="Ready">{String(draft.loaded)}</output>
      <output aria-label="Error">{draft.error}</output>
      <button
        type="button"
        onClick={() => {
          draft.setText((text) => `${text}!`);
        }}
      >
        Append
      </button>
    </section>
  );
};

test("draft subscriptions restore each scope once and persist functional updates synchronously", async () => {
  sessionStorage.clear();
  sessionStorage.setItem(
    "chatjs.eve.composer:owner:first",
    JSON.stringify({ text: "first", attachments: [], selectedTool: null })
  );
  sessionStorage.setItem(
    "chatjs.eve.composer:owner:second",
    JSON.stringify({ text: "second", attachments: [], selectedTool: null })
  );
  let fixture: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    fixture = createDomHarness(<Draft scope="first" />);
  });
  try {
    await expect
      .element(page.getByLabelText("Ready"))
      .toHaveTextContent("true");
    await expect
      .element(page.getByLabelText("Draft"))
      .toHaveTextContent("first");
    await act(async () => {
      await page.getByRole("button", { name: "Append" }).click();
    });
    expect(sessionStorage.getItem("chatjs.eve.composer:owner:first")).toContain(
      '"text":"first!"'
    );
    act(() => {
      fixture?.update(<Draft scope="second" />);
    });
    await expect
      .element(page.getByLabelText("Draft"))
      .toHaveTextContent("second");
    act(() => {
      fixture?.update(<Draft scope="first" />);
    });
    await expect
      .element(page.getByLabelText("Draft"))
      .toHaveTextContent("first!");
  } finally {
    act(() => {
      fixture?.unmount();
    });
    sessionStorage.clear();
  }
});

test("unavailable storage reports restore and save failures without losing in-memory edits", async () => {
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  let fixture: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    fixture = createDomHarness(<Draft scope="failed" />);
  });
  try {
    await expect
      .element(page.getByLabelText("Error"))
      .toHaveTextContent("could not be restored");
    await act(async () => {
      await page.getByRole("button", { name: "Append" }).click();
    });
    await expect.element(page.getByLabelText("Draft")).toHaveTextContent("!");
    await expect
      .element(page.getByLabelText("Error"))
      .toHaveTextContent("could not be saved");
    get.mockRestore();
    set.mockRestore();
    await act(async () => {
      await page.getByRole("button", { name: "Append" }).click();
    });
    await expect.element(page.getByLabelText("Error")).toHaveTextContent("");
  } finally {
    act(() => {
      fixture?.unmount();
    });
    get.mockRestore();
    set.mockRestore();
    sessionStorage.clear();
  }
});
