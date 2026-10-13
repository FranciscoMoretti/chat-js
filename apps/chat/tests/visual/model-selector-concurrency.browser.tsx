import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ModelSelector } from "@/components/model-selector";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import type { SelectedModelValue } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { mount, unmount } from "@/tests/visual/primitive-mount";

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

const committedCounts = { [primary]: 1 };
const speculativeCounts = { [primary]: 5 };

test("a suspended selection render cannot change the visible count callback", async () => {
  const never = Promise.withResolvers<undefined>();
  const action = vi.fn<(selection: SelectedModelValue) => void>();
  const Block = ({
    blocked,
  }: {
    readonly blocked: boolean;
  }): React.ReactNode => {
    if (blocked) {
      React.use(never.promise);
    }
    return null;
  };
  const Fixture = ({
    value,
  }: {
    readonly value: SelectedModelValue;
  }): React.JSX.Element => (
    <React.Suspense>
      <ModelSelector
        onModelSelectionChangeAction={action}
        selectedModelId={primary}
        selectedModelSelection={value}
      />
      <Block blocked={value === speculativeCounts} />
    </React.Suspense>
  );
  const fixture = await mount(<Fixture value={committedCounts} />);
  try {
    await page.getByTestId("model-selector").click();
    await act(async () => {
      await Promise.resolve();
      React.startTransition(() => {
        fixture.root.render(<Fixture value={speculativeCounts} />);
      });
    });
    await page.getByRole("button", { exact: true, name: "1×" }).click();
    await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
    expect(action).toHaveBeenCalledWith({ [primary]: 2 });
  } finally {
    await unmount(fixture);
  }
});

const crossRowCases = [
  {
    initialSelection: committedCounts,
    operation: "select",
    primaryUpdate: { [primary]: 2 },
    result: { [primary]: 2, [secondary]: 1 },
  },
  {
    initialSelection: { [primary]: 1, [secondary]: 1 },
    operation: "count",
    primaryUpdate: { [primary]: 2, [secondary]: 1 },
    result: { [primary]: 2, [secondary]: 2 },
  },
];
const setModelCountToTwo = async (modelName: string): Promise<void> => {
  await page
    .getByRole("option", { name: modelName })
    .getByRole("button", { exact: true, name: "1×" })
    .click();
  await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
  await expect
    .element(page.getByRole("menuitem", { exact: true, name: "2x" }))
    .not.toBeInTheDocument();
};
test.each(crossRowCases)(
  "$operation on another row preserves the first model's committed count",
  async ({
    initialSelection,
    operation,
    primaryUpdate,
    result,
  }: {
    readonly initialSelection: SelectedModelValue;
    readonly operation: string;
    readonly primaryUpdate: SelectedModelValue;
    readonly result: SelectedModelValue;
  }) => {
    const action = vi.fn<(selection: SelectedModelValue) => void>();
    const Fixture = (): React.JSX.Element => {
      const [value, setValue] =
        React.useState<SelectedModelValue>(initialSelection);
      const change = React.useCallback((next: SelectedModelValue): void => {
        setValue(next);
        action(next);
      }, []);
      return (
        <ModelSelector
          onModelSelectionChangeAction={change}
          selectedModelId={primary}
          selectedModelSelection={value}
        />
      );
    };
    const fixture = await mount(<Fixture />);
    try {
      await page.getByTestId("model-selector").click();
      await setModelCountToTwo("Primary model");
      expect(action).toHaveBeenLastCalledWith(primaryUpdate);
      const row = page.getByRole("option", { name: /Secondary model/u });
      await (operation === "select"
        ? row.click()
        : setModelCountToTwo("Secondary model"));
      expect(action).toHaveBeenLastCalledWith(result);
      await takeSnapshot(`model-selector-cross-row-${operation}`);
    } finally {
      await unmount(fixture);
    }
  }
);
