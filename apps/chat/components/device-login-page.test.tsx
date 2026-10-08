import React, { createElement } from "react";
import { create } from "react-test-renderer";
// oxlint-disable-next-line eslint/sort-imports -- The act export was removed after verifying it is identical to React.act; keep the renderer's import declaration in its original runtime position pending the module-effects review.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

import { DeviceLoginPage } from "./device-login-page";

const mocks = vi.hoisted(() => ({
  transferUser:
    vi.fn<
      (
        args: Readonly<{ fetchOptions?: Readonly<{ onError?: () => void }> }>
      ) => Promise<{ done: true }>
    >(),
}));

vi.mock("@/lib/auth-client", () => ({
  default: {
    electron: { transferUser: mocks.transferUser },
    getSession: vi.fn(),
  },
}));
vi.mock("next/link", () => ({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native anchor refs, React children and open CSS/string aliases to React.createElement; the readonly outer fields retain those native members flagged by the rule.
  default: (props: Readonly<ComponentProps<"a">>): React.ReactElement =>
    createElement("a", props),
}));

const searchParams = new URLSearchParams("done=1");

vi.mock("next/navigation", () => ({
  usePathname: (): string => "/device-login",
  useSearchParams: (): URLSearchParams => searchParams,
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  mocks.transferUser.mockReset();
});
/* oxlint-disable init-declarations, max-statements, no-magic-numbers, typescript/promise-function-async -- device-login-page.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

// oxlint-disable-next-line eslint/max-lines-per-function -- Readonly parameter declarations add type-only lines to this existing cohesive operation; preserve its ordered runtime behavior.
describe("device login page", () => {
  // oxlint-disable-next-line eslint/max-lines-per-function -- Readonly parameter declarations add type-only lines to this existing cohesive operation; preserve its ordered runtime behavior.
  it("shows retry transfer progress and returns to waiting after onError", () => {
    const transfer = Promise.withResolvers<{ done: true }>();
    let fetchOptions:
      | {
          onError?: () => void;
        }
      | undefined;
    mocks.transferUser.mockImplementation(({ fetchOptions: options }) => {
      fetchOptions = options;
      return transfer.promise;
    });

    // oxlint-disable-next-line typescript/no-deprecated -- `create` is deprecated with react-test-renderer; keep its existing renderer fixture until the test migrates to a different renderer.
    let renderer: ReturnType<typeof create> | undefined;
    React.act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- `create` is deprecated with react-test-renderer; keep its existing renderer fixture until the test migrates to a different renderer.
      renderer = create(<DeviceLoginPage />);
    });

    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(renderer?.root.findByType("a").props.href).toBe("/");

    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    const retryButton = renderer?.root.find(
      (node: {
        readonly props: Readonly<Record<string, unknown>>;
        readonly type: unknown;
        readonly children: readonly unknown[];
      }) => node.type === "button" && node.children.includes("Try again")
    );
    expect(retryButton).toBeDefined();

    React.act(() => {
      // oxlint-disable-next-line typescript/no-unsafe-call, oxc/no-optional-chaining -- typescript/no-unsafe-call: `ReactTestInstance.props` is declared as `any` by the pinned renderer types, so this is the fixture's native renderer ABI boundary. Optional chain: Keep the existing nullish guard when reading props from retryButton; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      retryButton?.props.onClick();
    });
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      renderer?.root.findAll(
        (node: {
          readonly props: Readonly<Record<string, unknown>>;
          readonly type: unknown;
          readonly children: readonly unknown[];
        }) => node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(1);

    React.act(() => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling fetchOptions.onError; read onError from fetchOptions; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
      fetchOptions?.onError?.();
    });
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      renderer?.root.findAll(
        (node: {
          readonly props: Readonly<Record<string, unknown>>;
          readonly type: unknown;
          readonly children: readonly unknown[];
        }) => node.children.includes("You're signed in")
      )
    ).toHaveLength(1);
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading root from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      renderer?.root.findAll(
        (node: {
          readonly props: Readonly<Record<string, unknown>>;
          readonly type: unknown;
          readonly children: readonly unknown[];
        }) => node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(0);
  });
});
/* oxlint-enable init-declarations, max-statements, no-magic-numbers, typescript/promise-function-async */
