/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React, { createElement } from "react";
import type { ComponentProps } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeviceLoginPage } from "./device-login-page";
/* oxlint-enable sort-imports */

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
/* oxlint-disable init-declarations, max-statements, no-magic-numbers, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- device-login-page.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including renderer?.root.findByType("a").props.href); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including node); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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

    expect(renderer?.root.findByType("a").props.href).toBe("/");

    const retryButton = renderer?.root.find(
      (node) => node.type === "button" && node.children.includes("Try again")
    );
    expect(retryButton).toBeDefined();

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This device-login-page fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      retryButton?.props.onClick();
    });
    expect(
      renderer?.root.findAll((node) =>
        node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(1);

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      fetchOptions?.onError?.();
    });
    expect(
      renderer?.root.findAll((node) =>
        node.children.includes("You're signed in")
      )
    ).toHaveLength(1);
    expect(
      renderer?.root.findAll((node) =>
        node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(0);
  });
});
/* oxlint-enable init-declarations, max-statements, no-magic-numbers, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
