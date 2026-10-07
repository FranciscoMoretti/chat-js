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
    return this.state.failed ? (
      <p role="alert">Selection failed. Try again.</p>
    ) : (
      this.props.children
    );
  }
}

const mount = async (
  action: (selection: SelectedModelValue) => void | Promise<void>,
  selection: SelectedModelValue = primary
): Promise<() => Promise<void>> => {
  const container = document.createElement("div");
  container.className = "p-8";
  document.body.append(container);
  const root = createRoot(container, {
    onCaughtError: vi.fn<(error: unknown) => void>(),
  });
  await act(async () => {
    await Promise.resolve();
    root.render(
      <SelectionBoundary>
        <ModelSelector
          onModelSelectionChangeAction={action}
          selectedModelId={primary}
          selectedModelSelection={selection}
        />
      </SelectionBoundary>
    );
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
/* oxlint-disable max-statements -- Drive each selection input through the same native React Action rejection boundary. */
test.each(modes)(
  "%s forwards its promise to the React rejection owner",
  async (mode) => {
    const pending = Promise.withResolvers<undefined>();
    const action = vi.fn().mockReturnValue(pending.promise);
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
