import { disableAutoSnapshot } from "@uiverify/vitest";
import { act, lazy, Suspense, useState } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { definePlugin, defineSlot, Plugins, slot } from "@/lib/ui-slots";
import { mount, renderRoot, unmount } from "./primitive-mount";

const Actions = defineSlot<{ readonly label: string }>();
const Other = defineSlot();
const Counter = ({ label }: { readonly label: string }) => {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setCount(count + 1);
      }}
    >
      {label}: {count}
    </button>
  );
};
const counter = definePlugin({
  id: "counter",
  slots: [slot(Actions, Counter)],
});
const extra = definePlugin({
  id: "extra",
  slots: [slot(Actions, ({ label }) => <span>Extra {label}</span>)],
});

const tree = (reverse: boolean) => (
  <Plugins plugins={reverse ? [extra, counter] : [counter, extra]}>
    <Actions label="Outer" />
    <Plugins plugins={[counter]}>
      <Actions label="Inner" />
    </Plugins>
    <Plugins plugins={[]}>
      <Actions label="Empty" />
    </Plugins>
  </Plugins>
);

// Protect component identity and nearest-scope props across installed-list changes.
test("slots preserve mounted state on reorder and isolate nested plugin scopes", async () => {
  disableAutoSnapshot();
  const fixture = await mount(tree(false));
  try {
    await act(async () => {
      await page.getByRole("button", { name: "Outer: 0" }).click();
    });
    await renderRoot(fixture.root, tree(true));
    await expect
      .element(page.getByRole("button", { name: "Outer: 1" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Inner: 0" }))
      .toBeVisible();
    await expect.element(page.getByText("Extra Inner")).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Empty: 0" }))
      .not.toBeInTheDocument();
    expect(
      [...fixture.container.querySelectorAll("button, span")].map(
        (element) => element.textContent
      )
    ).toEqual(["Extra Outer", "Outer: 1", "Inner: 0"]);
  } finally {
    await unmount(fixture);
  }
});

test("lazy contributions load on render, can be wrapped, and disappear while pending", async () => {
  disableAutoSnapshot();
  let loads = 0;
  const deferred = Promise.withResolvers<{ default: typeof Counter }>();
  const LazyCounter = lazy(async () => {
    loads += 1;
    return await deferred.promise;
  });
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- This wrapper captures the test-local lazy component and its deferred loader through JSX.
  const Wrapped = ({ label }: { readonly label: string }) => (
    <section aria-label="Local wrapper">
      <LazyCounter label={label} />
    </section>
  );
  const plugin = definePlugin({
    id: "lazy",
    slots: [slot(Actions, Wrapped)],
  });
  const fixture = await mount(
    <Plugins plugins={[plugin]}>
      <Other />
    </Plugins>
  );
  try {
    expect(loads).toBe(0);
    await renderRoot(
      fixture.root,
      <Plugins plugins={[plugin]}>
        <Suspense fallback={<p>Loading action</p>}>
          <Actions label="Lazy" />
        </Suspense>
      </Plugins>
    );
    await expect.element(page.getByText("Loading action")).toBeVisible();
    expect(loads).toBe(1);
    await renderRoot(
      fixture.root,
      <Plugins plugins={[]}>
        <Suspense fallback={<p>Loading action</p>}>
          <Actions label="Lazy" />
        </Suspense>
      </Plugins>
    );
    await expect
      .element(page.getByText("Loading action"))
      .not.toBeInTheDocument();
    deferred.resolve({ default: Counter });
    await renderRoot(
      fixture.root,
      <Plugins plugins={[plugin]}>
        <Suspense fallback={<p>Loading action</p>}>
          <Actions label="Lazy" />
        </Suspense>
      </Plugins>
    );
    await expect
      .element(page.getByRole("region", { name: "Local wrapper" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Lazy: 0" }))
      .toBeVisible();
    expect(loads).toBe(1);
  } finally {
    deferred.resolve({ default: Counter });
    await unmount(fixture);
  }
});
