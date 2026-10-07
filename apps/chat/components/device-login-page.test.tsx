import React, { createElement } from "react";
import type { ComponentProps } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { act, create } from "react-test-renderer";
/* oxlint-enable sort-imports */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeviceLoginPage } from "./device-login-page";

const mocks = vi.hoisted(() => ({
  transferUser: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  default: {
    electron: { transferUser: mocks.transferUser },
    getSession: vi.fn(),
  },
}));
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- device-login-page.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComponentProps<"a">). */

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => createElement("a", props),
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

const searchParams = new URLSearchParams("done=1");
/* oxlint-disable typescript/explicit-function-return-type -- device-login-page.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("next/navigation", () => ({
  usePathname: () => "/device-login",
  useSearchParams: () => searchParams,
}));
/* oxlint-enable typescript/explicit-function-return-type */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  mocks.transferUser.mockReset();
});
/* oxlint-disable init-declarations, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- device-login-page.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including node); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

describe("device login page", () => {
  it("shows retry transfer progress and returns to waiting after onError", () => {
    const transfer = Promise.withResolvers<{ done: true }>();
    let fetchOptions:
      | {
          onError?: () => void;
        }
      | undefined;
    mocks.transferUser.mockImplementation(({ fetchOptions: options }) => {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This device-login-page fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      fetchOptions = options;
      return transfer.promise;
    });

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(<DeviceLoginPage />);
    });

    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(renderer?.root.findByType("a").props.href).toBe("/");

    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    const retryButton = renderer?.root.find(
      (node) => node.type === "button" && node.children.includes("Try again")
    );
    expect(retryButton).toBeDefined();

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-unsafe-call, oxc/no-optional-chaining -- #596: This device-login-page fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. Optional chain: Keep the existing nullish guard when reading props from retryButton; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      retryButton?.props.onClick();
    });
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      renderer?.root.findAll((node) =>
        node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(1);

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling fetchOptions.onError; read onError from fetchOptions; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
      fetchOptions?.onError?.();
    });
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      renderer?.root.findAll((node) =>
        node.children.includes("You're signed in")
      )
    ).toHaveLength(1);
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      renderer?.root.findAll((node) =>
        node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(0);
  });
});
/* oxlint-enable init-declarations, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
