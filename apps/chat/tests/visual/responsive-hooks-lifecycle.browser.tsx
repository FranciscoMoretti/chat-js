import { createDomHarness } from "@/components/test-dom-harness";
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMounted } from "@/hooks/use-mounted";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalInnerWidth = Object.getOwnPropertyDescriptor(
  window,
  "innerWidth"
);
const originalMatchMedia = Object.getOwnPropertyDescriptor(
  globalThis,
  "matchMedia"
);

const Value = ({ value }: { readonly value: boolean }): React.JSX.Element => (
  <output>{String(value)}</output>
);

const MountedValue = ({
  onValue,
}: {
  readonly onValue?: (value: boolean) => void;
}): React.JSX.Element => {
  const value = useMounted();
  onValue?.(value);
  return <Value value={value} />;
};

const MobileValue = ({
  onValue,
}: {
  readonly onValue?: (value: boolean) => void;
}): React.JSX.Element => {
  const value = useIsMobile();
  onValue?.(value);
  return <Value value={value} />;
};

const MediaQueryValue = ({
  onValue,
  query,
}: {
  readonly onValue?: (value: boolean) => void;
  readonly query: string;
}): React.JSX.Element => {
  const value = useMediaQuery(query);
  onValue?.(value);
  return <Value value={value} />;
};

type MediaListenerMock = ReturnType<
  typeof vi.fn<(eventType: string, listener: () => void) => void>
>;

interface BrowserMediaQuery {
  addEventListener: MediaListenerMock;
  readonly matches: boolean;
  removeEventListener: MediaListenerMock;
}

interface MatchMediaFixture {
  addEventListener: MediaListenerMock;
  browserWindow: {
    innerWidth: number;
    matchMedia: ReturnType<typeof vi.fn<() => BrowserMediaQuery>>;
  };
  removeEventListener: MediaListenerMock;
  setMatches: (nextMatches: boolean) => void;
}

const installMatchMedia = ({
  initialMatches,
  innerWidth,
}: {
  readonly initialMatches: boolean;
  readonly innerWidth: number;
}): MatchMediaFixture => {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const addEventListener = vi.fn((eventType: string, listener: () => void) => {
    listeners.add(listener);
  });
  const removeEventListener = vi.fn(
    (eventType: string, listener: () => void) => {
      listeners.delete(listener);
    }
  );
  const mediaQueryList = {
    addEventListener,
    get matches(): boolean {
      return matches;
    },
    removeEventListener,
  };
  const browserWindow = {
    get innerWidth(): number {
      return window.innerWidth;
    },
    set innerWidth(value: number) {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value,
        writable: true,
      });
    },
    matchMedia: vi.fn(() => mediaQueryList),
  };

  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: browserWindow.matchMedia,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: innerWidth,
    writable: true,
  });

  return {
    addEventListener,
    browserWindow,
    removeEventListener,
    setMatches(nextMatches: boolean): void {
      matches = nextMatches;
      for (const listener of listeners) {
        listener();
      }
    },
  };
};

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(globalThis, "matchMedia", originalMatchMedia);
  } else {
    Reflect.deleteProperty(globalThis, "matchMedia");
  }

  if (originalInnerWidth) {
    Object.defineProperty(window, "innerWidth", originalInnerWidth);
  }
});

describe("responsive hooks", () => {
  it("uses browser values on the first client render", () => {
    const browser = installMatchMedia({
      initialMatches: true,
      innerWidth: 640,
    });
    const mountedValues: boolean[] = [];
    let mobile = false;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
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

    act(() => {
      rendered.unmount();
    });
  });

  it("updates media and mobile values when the media query changes", () => {
    const browser = installMatchMedia({
      initialMatches: false,
      innerWidth: 1024,
    });
    let media = false;
    let mobile = false;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
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

    act(() => {
      rendered.unmount();
    });
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
