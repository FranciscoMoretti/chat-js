import React from "react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { act, create } from "react-test-renderer";
/* oxlint-enable sort-imports */
import { afterEach, expect, test, vi } from "vitest";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  EveOptimisticResponseGroup,
  shouldAppendEveOptimisticResponseGroup,
} from "./eve-optimistic-response-group";
/* oxlint-enable sort-imports */

const operationId = "11111111-1111-4111-8111-111111111111";
/* oxlint-disable typescript/explicit-function-return-type -- eve-optimistic-response-group.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/providers/chat-models-provider", () => ({
  useChatModels: () => ({
    getModelById: (id: string) => ({
      id,
      name: id === "first-model" ? "First model" : "Second model",
    }),
  }),
}));
/* oxlint-enable typescript/explicit-function-return-type */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.clearAllMocks());

test("does not append an edited turn after the source transcript", () => {
  expect(
    shouldAppendEveOptimisticResponseGroup({
      forkKind: "edit",
      message: "Edited request",
      modelIds: ["first-model", "second-model"],
      operationId,
    })
  ).toBe(false);
  expect(
    shouldAppendEveOptimisticResponseGroup({
      forkKind: "comparison",
      message: "Follow-up request",
      modelIds: ["first-model", "second-model"],
      operationId,
    })
  ).toBe(true);
});
/* oxlint-disable init-declarations, max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types -- eve-optimistic-response-group.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including button). */

test("renders stable disabled generating cards from the durable comparison request", () => {
  // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
  let renderer: ReturnType<typeof create> | undefined;
  // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
  act(() => {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    renderer = create(
      <EveOptimisticResponseGroup
        operation={{
          message: "Compare this request",
          modelIds: ["first-model", "second-model"],
          operationId,
        }}
      />
    );
  });

  try {
    const buttons = renderer?.root.findAllByType("button") ?? [];
    expect(buttons).toHaveLength(2);
    // oxlint-disable-next-line typescript/no-unsafe-return -- #598: This eve-optimistic-response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    expect(buttons.map((button) => button.props.disabled)).toEqual([
      true,
      true,
    ]);
    const output = JSON.stringify(renderer?.toJSON());
    expect(output).toContain("Compare this request");
    expect(output).toContain("First model");
    expect(output).toContain("Second model");
    expect(output.match(/Generating\.\.\./gu)).toHaveLength(2);
  } finally {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => renderer?.unmount());
  }
});
/* oxlint-enable init-declarations, max-statements, no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types */
