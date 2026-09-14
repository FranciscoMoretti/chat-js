import { act, create } from "react-test-renderer";
import { afterEach, expect, test, vi } from "vitest";

import {
  EveOptimisticResponseGroup,
  shouldAppendEveOptimisticResponseGroup,
} from "./eve-optimistic-response-group";

const operationId = "11111111-1111-4111-8111-111111111111";

vi.mock("@/providers/chat-models-provider", () => ({
  useChatModels: () => ({
    getModelById: (id: string) => ({
      id,
      name: id === "first-model" ? "First model" : "Second model",
    }),
  }),
}));

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

test("renders stable disabled generating cards from the durable comparison request", () => {
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
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
    act(() => renderer?.unmount());
  }
});
