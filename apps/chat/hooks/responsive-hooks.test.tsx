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

const Value = ({ value }: { value: boolean }) => (
  <output>{String(value)}</output>
);

const MountedValue = ({ onValue }: { onValue?: (value: boolean) => void }) => {
  const value = useMounted();
  onValue?.(value);
  return <Value value={value} />;
};

const MobileValue = ({ onValue }: { onValue?: (value: boolean) => void }) => {
  const value = useIsMobile();
  onValue?.(value);
  return <Value value={value} />;
};

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

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});

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
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(
        <>
          <MountedValue onValue={(value) => mountedValues.push(value)} />
          <MobileValue onValue={(value) => (mobile = value)} />
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

    act(() => rendered.unmount());
  });

  it("updates media and mobile values when the media query changes", () => {
    const browser = installMatchMedia({
      initialMatches: false,
      innerWidth: 1024,
    });
    let media = false;
    let mobile = false;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(
        <>
          <MediaQueryValue
            onValue={(value) => (media = value)}
            query="(min-width: 768px)"
          />
          <MobileValue onValue={(value) => (mobile = value)} />
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

    act(() => rendered.unmount());
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
