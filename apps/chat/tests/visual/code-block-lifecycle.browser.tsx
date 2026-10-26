import { disableAutoSnapshot, takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test } from "vitest";
import { CodeSnippet } from "@/components/code-snippet";
import { mount, renderRoot, unmount } from "@/tests/visual/primitive-mount";
import "./sandbox.css";

test("streamed code, changed language, and unknown languages preserve source without remount", async () => {
  disableAutoSnapshot();
  const fixture = await mount(<CodeSnippet code="" language="python" />);
  try {
    await renderRoot(
      fixture.root,
      <CodeSnippet code="print(53 * 41244)" language="python" />
    );
    await expect
      .poll(() => fixture.container.querySelector("pre")?.textContent)
      .toBe("print(53 * 41244)");
    await renderRoot(
      fixture.root,
      <CodeSnippet code="const x = 0;" language="typescript" />
    );
    await expect
      .poll(() => fixture.container.querySelector("pre")?.textContent)
      .toBe("const x = 0;");
    await renderRoot(
      fixture.root,
      <CodeSnippet code="plain output" language="unknown-language" />
    );
    await expect
      .poll(() => fixture.container.querySelector("pre")?.textContent)
      .toBe("plain output");
  } finally {
    await unmount(fixture);
  }
});

test("highlighting preserves literal source, blank lines, line numbers and keyboard focus", async () => {
  const fixture = await mount(
    <CodeSnippet
      code={'<img src=x onerror="alert(1)">\n\nsecond line'}
      language="html"
      lineNumbers
    />
  );
  try {
    const pre = fixture.container.querySelector("pre");
    await expect
      .poll(() => fixture.container.querySelector('[style*="--shiki-light"]'), {
        timeout: 10_000,
      })
      .not.toBeNull();
    const token = fixture.container.querySelector<HTMLElement>(
      '[style*="--shiki-light"]'
    );
    if (!token || !pre) {
      throw new Error("Highlighted code was not rendered");
    }
    expect(getComputedStyle(token).color).not.toBe(getComputedStyle(pre).color);
    expect(pre.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(fixture.container.querySelector("img")).toBeNull();
    expect(pre?.querySelectorAll('[data-slot="code-block-line"]')).toHaveLength(
      3
    );
    expect(pre?.dataset.numbered).toBe("true");
    pre?.focus();
    expect(document.activeElement).toBe(pre);
    await takeSnapshot("safe-highlighted-source");
  } finally {
    await unmount(fixture);
  }
});
