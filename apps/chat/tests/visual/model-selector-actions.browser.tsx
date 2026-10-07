/* oxlint-disable oxc/no-async-await -- Await native browser interactions, React commits, snapshot completion and cleanup in their original order. */
/* oxlint-disable sort-imports -- Oxfmt groups runtime, type and CSS imports by module; this grouping conflicts with sort-imports binding-syntax order. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ModelSelector } from "@/components/model-selector";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import type { SelectedModelValue } from "@/lib/ai/types";
import { config } from "@/lib/config";

import "./sandbox.css";
/* oxlint-enable sort-imports */

const primary = config.ai.workflows.title;
const secondary = config.ai.tools.code.edits;
const createModel = (
  id: AppModelDefinition["id"],
  name: string
): AppModelDefinition => ({
  apiModelId: id,
  context_window: 128_000,
  description: name,
  id,
  input: { audio: false, image: false, pdf: false, text: true, video: false },
  max_tokens: 16_384,
  name,
  object: "model",
  output: { audio: false, image: false, text: true, video: false },
  owned_by: "openai",
  pricing: {},
  reasoning: false,
  toolCall: false,
  type: "language",
});
const models = [
  createModel(primary, "Primary model"),
  createModel(secondary, "Secondary model"),
];
vi.mock("@/providers/chat-models-provider", () => ({
  useChatModels: (): object => ({
    allModels: models,
    getModelById: (id: string): AppModelDefinition | undefined =>
      models.find(({ id: modelId }: { readonly id: string }) => modelId === id),
    models,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: (): object => ({}) }));
vi.mock("@/providers/session-provider", () => ({
  useSession: (): object => ({ data: { user: { id: "fixture" } } }),
}));

class SelectionBoundary extends React.Component<
  { readonly children: React.ReactNode },
  { failed: boolean }
> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- ReactNode uses React's element and portal declarations; the fixture constructor forwards props without mutation.
  public constructor(props: SelectionBoundary["props"]) {
    super(props);
    this.state = { failed: false };
  }
  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  public override render(): React.ReactNode {
    // oxlint-disable-next-line no-ternary -- Preserve lazy React branch selection; pinned unicorn/prefer-ternary rejects an if/else value assignment.
    return this.state.failed ? (
      /* oxlint-disable react/jsx-no-literals -- Fixed boundary fallback is authored fixture copy; no translation layer exists here. */
      <p role="alert">Selection failed. Try again.</p>
    ) : (
      /* oxlint-enable react/jsx-no-literals */
      this.props.children
    );
  }
}

const mount = async (
  action: (selection: SelectedModelValue) => void | Promise<void>,
  selection: SelectedModelValue = primary,
  onSend?: (selection: SelectedModelValue) => void
): Promise<() => Promise<void>> => {
  const container = document.createElement("div");
  container.className = "p-8";
  container.dataset.testid = "model-selection-fixture";
  document.body.append(container);
  const root = createRoot(container, {
    onCaughtError: vi.fn<(error: unknown) => void>(),
  });
  /* oxlint-disable react/no-multi-comp, react/only-export-components -- This local controlled consumer and its error boundary are mounted only by the browser test; exporting them would add unused fixture APIs. */
  const Fixture = (): React.JSX.Element => {
    const [value, setValue] = React.useState(selection);
    /* oxlint-disable typescript/promise-function-async -- Return the producer's original promise and preserve synchronous throws in this controlled consumer fixture. */
    const changeSelection = React.useCallback(
      (next: SelectedModelValue): void | Promise<void> => {
        if (onSend) {
          setValue(next);
        }
        return action(next);
      },
      []
    );
    /* oxlint-enable typescript/promise-function-async */
    return (
      <SelectionBoundary>
        <ModelSelector
          onModelSelectionChangeAction={changeSelection}
          selectedModelId={primary}
          selectedModelSelection={value}
        />
        {onSend && (
          /* oxlint-disable react/jsx-no-literals, react-perf/jsx-no-new-function-as-prop -- This fixture's Send control reads its current committed selection, just like the composer. */
          <button type="button" onClick={() => onSend(value)}>
            Send
          </button>
          /* oxlint-enable react/jsx-no-literals, react-perf/jsx-no-new-function-as-prop */
        )}
      </SelectionBoundary>
    );
  };
  /* oxlint-enable react/no-multi-comp, react/only-export-components */
  await act(async () => {
    await Promise.resolve();
    root.render(<Fixture />);
  });
  return async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve();
      root.unmount();
    });
    container.remove();
  };
};

/* oxlint-disable max-statements -- Verify deferred selection completion, immediate menu close, and rejection routing using the actual React 19 transition. */
test("model selection keeps optimism while pending and routes rejection to React", async () => {
  const pending = Promise.withResolvers<undefined>();
  const action = vi.fn().mockReturnValue(pending.promise);
  const cleanup = await mount(action);
  try {
    await page.getByTestId("model-selector").click();
    await page.getByRole("option", { name: /Secondary model/u }).click();
    expect(action).toHaveBeenCalledWith(secondary);
    await expect
      .element(page.getByTestId("model-selector"))
      .toHaveTextContent("Secondary model");
    await expect
      .element(page.getByRole("option", { name: /Secondary model/u }))
      .not.toBeInTheDocument();
    await takeSnapshot("model-selector-pending-action");
    await act(async () => {
      await Promise.resolve();
      pending.reject(new Error("Selection rejected"));
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Selection failed. Try again.");
  } finally {
    pending.reject(new Error("Test cleanup"));
    await cleanup();
  }
});
/* oxlint-enable max-statements */

const modes = ["multiple-on", "multiple-off", "toggle-model", "increase-count"];
/* oxlint-disable max-statements -- Select and send through every native picker control while the preference request remains deferred. */
test.each(["single", ...modes])(
  "%s uses the new selection for Send before preference saving completes",
  async (mode) => {
    const pending = Promise.withResolvers<never>();
    const action = vi.fn().mockReturnValue(pending.promise);
    const send = vi.fn<(selection: SelectedModelValue) => void>();
    /* oxlint-disable no-ternary -- Preserve lazy fixture selection; pinned unicorn/prefer-ternary rejects if/else value assignment. */
    const selection =
      mode === "single" || mode === "multiple-on" ? primary : { [primary]: 1 };
    /* oxlint-enable no-ternary */
    const cleanup = await mount(action, selection, send);
    try {
      await page.getByTestId("model-selector").click();
      if (mode === "multiple-on" || mode === "multiple-off") {
        await page.getByRole("switch", { name: "Use Multiple Models" }).click();
        await page.getByTestId("model-selector").click();
      } else if (mode === "single" || mode === "toggle-model") {
        await page.getByRole("option", { name: /Secondary model/u }).click();
        if (mode === "toggle-model") {
          await page.getByTestId("model-selector").click();
        }
      } else {
        await page.getByRole("button", { exact: true, name: "1×" }).click();
        await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
        await page.getByTestId("model-selector").click();
      }
      expect(action).toHaveBeenCalledOnce();
      await page.getByRole("button", { exact: true, name: "Send" }).click();
      const [[nextSelection]] = action.mock.calls;
      expect(send).toHaveBeenCalledWith(nextSelection);
      if (mode === "single") {
        await takeSnapshot("model-selection-urgent-send");
        await page.getByTestId("model-selection-fixture").screenshot();
      }
      await act(async () => {
        await Promise.resolve();
        pending.reject(new Error("Preference saving rejected"));
      });
      await expect
        .element(page.getByRole("alert"))
        .toHaveTextContent("Selection failed. Try again.");
    } finally {
      pending.reject(new Error("Test cleanup"));
      await cleanup();
    }
  }
);
/* oxlint-enable max-statements */
/* oxlint-disable max-statements -- Drive each selection input through the same native React Action rejection boundary. */
test.each(modes)(
  "%s forwards its promise to the React rejection owner",
  async (mode) => {
    const pending = Promise.withResolvers<undefined>();
    const action = vi.fn().mockReturnValue(pending.promise);
    // oxlint-disable-next-line no-ternary -- Preserve lazy fixture selection; pinned unicorn/prefer-ternary rejects if/else value assignment.
    const selection = mode === "multiple-on" ? primary : { [primary]: 1 };
    const cleanup = await mount(action, selection);
    try {
      await page.getByTestId("model-selector").click();
      if (mode === "multiple-on" || mode === "multiple-off") {
        await page.getByRole("switch", { name: "Use Multiple Models" }).click();
      } else if (mode === "toggle-model") {
        await page.getByRole("option", { name: /Secondary model/u }).click();
      } else {
        await page.getByRole("button", { exact: true, name: "1×" }).click();
        await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
      }
      expect(action).toHaveBeenCalledOnce();
      await act(async () => {
        await Promise.resolve();
        pending.reject(new Error("Selection rejected"));
      });
      await expect
        .element(page.getByRole("alert"))
        .toHaveTextContent("Selection failed. Try again.");
    } finally {
      pending.reject(new Error("Test cleanup"));
      await cleanup();
    }
  }
);

/* oxlint-enable max-statements */

test("a synchronous action throw retains the React error boundary owner", async () => {
  const action = vi.fn<(selection: SelectedModelValue) => void | Promise<void>>(
    () => {
      throw new Error("Synchronous selection failure");
    }
  );
  const cleanup = await mount(action);
  try {
    await page.getByTestId("model-selector").click();
    await page.getByRole("option", { name: /Secondary model/u }).click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Selection failed. Try again.");
  } finally {
    await cleanup();
  }
});

/* oxlint-enable oxc/no-async-await */
