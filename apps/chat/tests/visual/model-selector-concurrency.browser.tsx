/* oxlint-disable oxc/no-async-await -- Await native browser interactions, React commits, snapshot completion and cleanup in their original order. */
/* oxlint-disable sort-imports -- Oxfmt groups runtime, type and CSS imports by module; this grouping conflicts with sort-imports binding-syntax order. */
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

/* oxlint-enable oxc/no-async-await */
