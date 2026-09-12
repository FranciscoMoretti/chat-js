import { takeSnapshot } from "@uiverify/vitest";
import { expect, test } from "vitest";

const pages = [
  { name: "threads", path: "/docs/threads" },
  { name: "database", path: "/docs/reference/database" },
  { name: "redis", path: "/docs/reference/redis" },
  { name: "storage", path: "/docs/storage" },
  { name: "custom-storage", path: "/docs/storage/custom" },
  { name: "home", path: "/docs" },
  { name: "registry", path: "/docs/registry" },
  { name: "tools", path: "/docs/tools/authoring" },
  { name: "namespaces", path: "/docs/registry/namespaces" },
  { name: "publishing", path: "/docs/registry/authoring" },
  { name: "registry-testing", path: "/docs/registry/testing" },
  { name: "word-count", path: "/docs/tools/word-count" },
  { name: "get-weather", path: "/docs/tools/get-weather" },
  { name: "retrieve-url", path: "/docs/tools/retrieve-url" },
  { name: "quickstart", path: "/docs/quickstart" },
  { name: "changelog", path: "/docs/changelog" },
  { name: "cookbook", path: "/docs/cookbook" },
  { name: "features", path: "/docs/features/overview" },
] as const;

for (const page of pages) {
  test(`docs ${page.name}`, async () => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    document.body.style.margin = "0";

    const frame = document.createElement("iframe");
    frame.title = `ChatJS docs: ${page.name}`;
    frame.src = page.path;
    frame.style.cssText = "border:0;display:block;height:100vh;width:100vw";
    document.body.append(frame);

    await new Promise<void>((resolve) => {
      frame.addEventListener("load", () => resolve(), { once: true });
    });

    const source = frame.contentDocument;
    expect(source?.querySelector("main")).not.toBeNull();

    if (!source) {
      throw new Error(`Unable to read ${page.path}`);
    }

    for (const attribute of source.documentElement.attributes) {
      document.documentElement.setAttribute(attribute.name, attribute.value);
    }
    document.head.innerHTML = source.head.innerHTML;
    document.body.innerHTML = source.body.innerHTML;

    await Promise.all(
      [...document.images].map((image) => image.decode().catch(() => undefined))
    );
    await document.fonts.ready;
    await takeSnapshot(page.name);
  });
}
