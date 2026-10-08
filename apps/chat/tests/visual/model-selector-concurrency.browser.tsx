/* oxlint-disable sort-imports -- Oxfmt groups runtime, type and CSS imports by module; this grouping conflicts with sort-imports binding-syntax order. */
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

const committedCounts = { [primary]: 1 };
const speculativeCounts = { [primary]: 5 };

/* oxlint-disable oxc/no-async-await -- Await actual browser controls and React commits before checking the selected count. */
/* oxlint-disable max-statements -- Exercise a suspended render and the committed count control in one mounted selector. */
test("a suspended selection render cannot change the visible count callback", async () => {
  const never = Promise.withResolvers<undefined>();
  const action = vi.fn<(selection: SelectedModelValue) => void>();
  /* oxlint-disable react/no-multi-comp, react/only-export-components -- Local fixtures suspend a native React transition around the actual selector. */
  const Block = ({
    blocked,
  }: {
    readonly blocked: boolean;
  }): React.ReactNode => {
    if (blocked) {
      React.use(never.promise);
    }
    // oxlint-disable-next-line unicorn/no-null -- A resolved suspension fixture renders no content, using React's native empty-child contract.
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
  /* oxlint-enable react/no-multi-comp, react/only-export-components */
  const fixture = await mount(<Fixture value={committedCounts} />);
  try {
    await page.getByTestId("model-selector").click();
    await act(async () => {
      await Promise.resolve();
      React.startTransition(() =>
        fixture.root.render(<Fixture value={speculativeCounts} />)
      );
    });
    await page.getByRole("button", { exact: true, name: "1×" }).click();
    await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
    expect(action).toHaveBeenCalledWith({ [primary]: 2 });
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable max-statements */
/* oxlint-enable oxc/no-async-await */

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
/* oxlint-disable oxc/no-async-await -- Await real count menu, row selection, and controlled React commits. */
/* oxlint-disable max-statements -- Keep the first model update and dependent second-row action in one native regression sequence. */
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
    /* oxlint-disable react/no-multi-comp, react/only-export-components -- This controlled fixture is mounted only by the native browser test. */
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
    /* oxlint-enable react/no-multi-comp, react/only-export-components */
    const fixture = await mount(<Fixture />);
    try {
      await page.getByTestId("model-selector").click();
      await page
        .getByRole("option", { name: /Primary model/u })
        .getByRole("button", { exact: true, name: "1×" })
        .click();
      await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
      expect(action).toHaveBeenLastCalledWith(primaryUpdate);
      const row = page.getByRole("option", { name: /Secondary model/u });
      if (operation === "select") {
        await row.click();
      } else {
        await row.getByRole("button", { exact: true, name: "1×" }).click();
        await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
      }
      expect(action).toHaveBeenLastCalledWith(result);
      await expect
        .element(page.getByRole("menuitem", { exact: true, name: "2x" }))
        .not.toBeInTheDocument();
      await takeSnapshot(`model-selector-cross-row-${operation}`);
    } finally {
      await unmount(fixture);
    }
  }
);
/* oxlint-enable max-statements */
/* oxlint-enable oxc/no-async-await */
