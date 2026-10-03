import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "./use-media-query";
import { useIsMobile } from "./use-mobile";
import { useMounted } from "./use-mounted";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalMatchMedia = Object.getOwnPropertyDescriptor(
  globalThis,
  "matchMedia"
);
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Value: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { value }: { value: boolean }). */

const Value = ({ value }: { value: boolean }): React.JSX.Element => (
  <output>{String(value)}</output>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- MountedValue: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { onValue }: { onValue?: (value: boolean) => void }). */

const MountedValue = ({ onValue }: { onValue?: (value: boolean) => void }) => {
  const value = useMounted();
  onValue?.(value);
  return <Value value={value} />;
};
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- MobileValue: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { onValue }: { onValue?: (value: boolean) => void }). */

const MobileValue = ({ onValue }: { onValue?: (value: boolean) => void }) => {
  const value = useIsMobile();
  onValue?.(value);
  return <Value value={value} />;
};
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- MediaQueryValue: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const MediaQueryValue = ({
  onValue,
  query,
}: {
  onValue?: (value: boolean) => void;
  query: string;
}) => {
  const value = useMediaQuery(query);
  onValue?.(value);
  return <Value value={value} />;
};
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- installMatchMedia: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const installMatchMedia = ({
  initialMatches,
  innerWidth,
}: {
  initialMatches: boolean;
  innerWidth: number;
}) => {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const addEventListener = vi.fn((_: string, listener: () => void) => {
    listeners.add(listener);
  });
  const removeEventListener = vi.fn((_: string, listener: () => void) => {
    listeners.delete(listener);
  });
  const mediaQueryList = {
    addEventListener,
    get matches() {
      return matches;
    },
    removeEventListener,
  };
  const browserWindow = {
    innerWidth,
    matchMedia: vi.fn(() => mediaQueryList),
  };

  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: browserWindow.matchMedia,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browserWindow,
  });

  return {
    addEventListener,
    browserWindow,
    removeEventListener,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      for (const listener of listeners) {
        listener();
      }
    },
  };
};
/* oxlint-enable id-length, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(globalThis, "matchMedia", originalMatchMedia);
  } else {
    Reflect.deleteProperty(globalThis, "matchMedia");
  }

  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop -- responsive-hooks.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract. */

describe("responsive hooks", () => {
  it("uses false for the server snapshot", () => {
    expect(renderToStaticMarkup(<MountedValue />)).toBe(
      "<output>false</output>"
    );
    expect(renderToStaticMarkup(<MobileValue />)).toBe(
      "<output>false</output>"
    );
    expect(
      renderToStaticMarkup(<MediaQueryValue query="(min-width: 768px)" />)
    ).toBe("<output>false</output>");
  });

  it("uses browser values on the first client render", () => {
    const browser = installMatchMedia({
      initialMatches: true,
      innerWidth: 640,
    });
    const mountedValues: boolean[] = [];
    let mobile = false;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <>
          <MountedValue
            onValue={(value) => {
              mountedValues.push(value);
            }}
          />
          <MobileValue
            onValue={(value) => {
              mobile = value;
            }}
          />
        </>
      );
    });

    expect(mountedValues).toEqual([true]);
    expect(mobile).toBe(true);
    expect(browser.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );

    const rendered = renderer;
    if (!rendered) {
      throw new Error("Expected hook harness to render");
    }

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => rendered.unmount());
  });

  it("updates media and mobile values when the media query changes", () => {
    const browser = installMatchMedia({
      initialMatches: false,
      innerWidth: 1024,
    });
    let media = false;
    let mobile = false;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <>
          <MediaQueryValue
            onValue={(value) => {
              media = value;
            }}
            query="(min-width: 768px)"
          />
          <MobileValue
            onValue={(value) => {
              mobile = value;
            }}
          />
        </>
      );
    });

    expect(media).toBe(false);
    expect(mobile).toBe(false);

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      browser.browserWindow.innerWidth = 640;
      browser.setMatches(true);
    });

    expect(media).toBe(true);
    expect(mobile).toBe(true);

    const rendered = renderer;
    if (!rendered) {
      throw new Error("Expected hook harness to render");
    }

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => rendered.unmount());
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop */
