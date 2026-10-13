import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";
import { Favicon } from "@/components/favicon";
import { FaviconGroup } from "@/components/favicon-group";
import { WebSourceBadge } from "@/components/source-badge";
import { Sources } from "@/components/sources";
import { McpConnectDialog } from "@/components/settings/mcp-connect-dialog";
import { ConnectorHeader } from "@/components/settings/connector-header";
import { mount, renderRoot, unmount } from "@/tests/visual/primitive-mount";
import "@/tests/visual/sandbox.css";

declare module "vitest/browser" {
  interface BrowserCommands {
    faviconAssets: () => Promise<void>;
  }
}

vi.mock("@/trpc/react", () => ({
  useTRPC: () => ({ mcp: { authorize: { mutationOptions: () => ({}) } } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
}));

const source = {
  content: "Example source description",
  source: "web",
  title: "Example source",
  url: "https://source.example.test",
} satisfies React.ComponentProps<typeof WebSourceBadge>["result"];

const faviconUrl = "https://favicon.example.test/icon.svg";

test("favicon sizes, source overlap, and connector fallback gallery", async () => {
  await commands.faviconAssets();
  const fixture = await mount(
    <div className="bg-background text-foreground grid w-96 gap-6 p-6">
      <div className="flex items-center gap-4">
        {["size-3", "size-4", "size-5"].map((className) => (
          <Favicon
            alt={`Icon ${className}`}
            className={className}
            key={className}
            url={faviconUrl}
          />
        ))}
        <Favicon alt="" url={faviconUrl} />
        <Favicon fallback={<span>Empty source fallback</span>} url="" />
      </div>
      <FaviconGroup
        sources={[
          { title: "First source", url: "https://first.example.test" },
          { title: "Second source", url: "https://second.example.test" },
          { title: "Third source", url: "https://third.example.test" },
        ]}
      />
      <WebSourceBadge result={source} />
      <Sources sources={[source]} />
      <ConnectorHeader
        isCustom
        name="Example connector"
        type="http"
        url="https://connector.example.test"
      />
      <div className="flex items-center gap-2">
        <Favicon
          alt="Unavailable icon"
          fallback={<span>Failed source fallback</span>}
          url={faviconUrl}
        />
        <span className="hidden">Unrelated sibling</span>
      </div>
    </div>
  );
  try {
    await expect
      .poll(() =>
        [...fixture.container.querySelectorAll("img")].every(
          (image) => image.complete && image.naturalWidth > 0
        )
      )
      .toBe(true);
    const sizes = [...fixture.container.querySelectorAll("img")]
      .slice(0, 3)
      .map((image) => image.getBoundingClientRect().width);
    expect(sizes).toEqual([12, 16, 20]);
    const groupImages = fixture.container
      .querySelector('img[alt="Favicon for First source"]')
      ?.parentElement?.querySelectorAll("img");
    expect(groupImages).toHaveLength(3);
    expect(groupImages?.[0]?.getAttribute("alt")).toBe(
      "Favicon for First source"
    );
    expect(groupImages?.[1]?.getBoundingClientRect().left).toBeLessThan(
      groupImages?.[0]?.getBoundingClientRect().right ?? 0
    );
    const unavailable = fixture.container.querySelector(
      'img[alt="Unavailable icon"]'
    );
    const connectorImage = fixture.container.querySelector(
      'img[alt*="connector.example.test"]'
    );
    expect(connectorImage).not.toBeNull();
    act(() => {
      unavailable?.dispatchEvent(new Event("error"));
      connectorImage?.dispatchEvent(new Event("error"));
    });
    expect(fixture.container.textContent).toContain("Failed source fallback");
    expect(fixture.container.querySelector("svg.lucide-globe")).not.toBeNull();
    expect(fixture.container.querySelector("span.hidden")?.textContent).toBe(
      "Unrelated sibling"
    );
    await takeSnapshot("favicon-gallery");
    await page.elementLocator(fixture.container).screenshot({
      path: "../../../test-results/favicon-gallery.png",
    });
  } finally {
    await unmount(fixture);
  }
});

test("favicon loads remote URLs directly and recovers after a failed source changes", async () => {
  await commands.faviconAssets();
  const consoleError = vi.spyOn(console, "error");
  const fixture = await mount(
    <Favicon
      alt="Example website"
      fallback={<span>Icon unavailable</span>}
      referrerPolicy="no-referrer"
      url={faviconUrl}
    />
  );
  try {
    const image = fixture.container.querySelector("img");
    await expect.poll(() => image?.naturalWidth).toBe(16);
    expect(image?.dataset.nimg).toBe("1");
    expect(image?.getAttribute("src")).toBe(faviconUrl);
    expect(image?.getAttribute("srcset")).toBeNull();
    expect(image?.getAttribute("width")).toBe("16");
    expect(image?.getAttribute("height")).toBe("16");
    expect(image?.getAttribute("alt")).toBe("Example website");
    expect(image?.referrerPolicy).toBe("no-referrer");
    expect(image?.loading).toBe("eager");
    await renderRoot(
      fixture.root,
      <Favicon
        fallback={<span>Icon unavailable</span>}
        url="https://favicon.example.test/broken.svg"
      />
    );
    await act(async () => {
      const brokenImage = fixture.container.querySelector("img");
      if (brokenImage && !brokenImage.complete) {
        await expect(brokenImage.decode()).rejects.toBeInstanceOf(DOMException);
      }
    });
    expect(fixture.container.querySelector("img")).toBeNull();
    expect(fixture.container.textContent).toBe("Icon unavailable");
    await renderRoot(
      fixture.root,
      <Favicon alt="Recovered icon" url={`${faviconUrl}?recovered`} />
    );
    await expect
      .poll(() => fixture.container.querySelector("img")?.naturalWidth)
      .toBe(16);
    expect(fixture.container.querySelector("img")?.alt).toBe("Recovered icon");
    await renderRoot(
      fixture.root,
      <Favicon fallback={<span>Empty icon</span>} url="" />
    );
    expect(fixture.container.querySelector("img")).toBeNull();
    expect(fixture.container.textContent).toBe("Empty icon");
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    await unmount(fixture);
    consoleError.mockRestore();
  }
});

test("MCP connect dialog keeps its layout when the favicon falls back", async () => {
  await commands.faviconAssets();
  const fixture = await mount(
    <McpConnectDialog
      connector={{
        id: "example-connector",
        name: "Example connector",
        type: "http",
        url: "https://connector.example.test/mcp",
      }}
      onClose={vi.fn<() => void>()}
      open
    />
  );
  try {
    await act(async () => {
      await Promise.all(
        document
          .getAnimations()
          .map(async (animation) => await animation.finished)
      );
    });
    const image = document.querySelector<HTMLImageElement>(
      '[role="dialog"] img'
    );
    await expect.poll(() => image?.naturalWidth).toBe(16);
    await expect.poll(() => image?.getBoundingClientRect().width).toBe(20);
    const iconBox = image?.parentElement;
    const width = iconBox?.getBoundingClientRect().width;
    act(() => {
      image?.dispatchEvent(new Event("error"));
    });
    expect(document.querySelector('[role="dialog"] img')).toBeNull();
    expect(iconBox?.querySelector("svg.lucide-globe")).not.toBeNull();
    expect(iconBox?.getBoundingClientRect().width).toBe(width);
    await expect
      .element(page.getByRole("dialog"))
      .toHaveStyle({ opacity: "1" });
    await takeSnapshot("mcp-connect-favicon-fallback");
    await page.getByRole("dialog").screenshot({
      path: "../../../test-results/favicon-connect-dialog.png",
    });
  } finally {
    await unmount(fixture);
  }
});
