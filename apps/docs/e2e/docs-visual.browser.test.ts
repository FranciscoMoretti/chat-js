import { expect, test } from "vitest";
import { takeSnapshot } from "@uiverify/vitest";

// First frames keep GIFs deterministic and below the archive resource limit.
const stillFrames: Record<string, string> = {
  "/docs/images/ai-models.gif": new URL(
    "fixtures/ai-models.png",
    import.meta.url
  ).href,
  "/docs/images/attachments.gif": new URL(
    "fixtures/attachments.png",
    import.meta.url
  ).href,
  "/docs/images/branching.gif": new URL(
    "fixtures/branching.png",
    import.meta.url
  ).href,
  "/docs/images/canvas.gif": new URL("fixtures/canvas.png", import.meta.url)
    .href,
  "/docs/images/code-execution.gif": new URL(
    "fixtures/code-execution.png",
    import.meta.url
  ).href,
  "/docs/images/image-generation.gif": new URL(
    "fixtures/image-generation.png",
    import.meta.url
  ).href,
  "/docs/images/resumable-streams.gif": new URL(
    "fixtures/resumable-streams.png",
    import.meta.url
  ).href,
  "/docs/images/web-search.gif": new URL(
    "fixtures/web-search.png",
    import.meta.url
  ).href,
};

const pages = [
  { name: "using-plugins", path: "/docs/plugins/using-plugins" },
  { name: "plugin-authoring", path: "/docs/plugins/create-plugin" },
  { name: "mcp-plugin", path: "/docs/plugins/mcp" },
  { name: "attachments-plugin", path: "/docs/plugins/attachments" },
  { name: "analytics-plugin", path: "/docs/plugins/vercel-analytics" },
  {
    name: "speed-insights-plugin",
    path: "/docs/plugins/vercel-speed-insights",
  },
  { name: "langfuse-plugin", path: "/docs/plugins/langfuse" },
  { name: "plugins", path: "/docs/plugins/overview" },
  {
    name: "plugin-api",
    path: "/docs/reference/plugin-api",
  },
  { name: "suggestions-plugin", path: "/docs/plugins/followup-suggestions" },
  { name: "ai-titles-plugin", path: "/docs/plugins/ai-titles" },
  { name: "sharing-plugin", path: "/docs/plugins/sharing" },
  { name: "search-plugin", path: "/docs/plugins/search" },
  { name: "feedback-plugin", path: "/docs/plugins/feedback" },
  { name: "projects-plugin", path: "/docs/plugins/projects" },
  { name: "threads", path: "/docs/threads" },
  { name: "database", path: "/docs/reference/database" },
  { name: "storage", path: "/docs/storage" },
  { name: "custom-storage", path: "/docs/storage/custom" },
  { name: "home", path: "/docs" },
  { name: "registry", path: "/docs/registry" },
  { name: "tools", path: "/docs/tools/authoring" },
  { name: "namespaces", path: "/docs/registry/namespaces" },
  { name: "publishing", path: "/docs/registry/authoring" },
  { name: "registry-mirror", path: "/docs/registry/mirror" },
  { name: "registry-validation", path: "/docs/registry/validation" },
  { name: "registry-testing", path: "/docs/registry/testing" },
  { name: "word-count", path: "/docs/tools/word-count" },
  { name: "get-weather", path: "/docs/tools/get-weather" },
  { name: "retrieve-url", path: "/docs/tools/retrieve-url" },
  { name: "generate-image", path: "/docs/tools/generate-image" },
  { name: "generate-video", path: "/docs/tools/generate-video" },
  { name: "quickstart", path: "/docs/quickstart" },
  { name: "cli", path: "/docs/cli" },
  { name: "changelog", path: "/docs/changelog" },
  { name: "cookbook", path: "/docs/cookbook" },
  { name: "deployment", path: "/docs/deployment" },
  { name: "sandboxes", path: "/docs/deployment/sandboxes" },
  { name: "web-search", path: "/docs/tools/web-search" },
  { name: "deep-research", path: "/docs/tools/deep-research" },
  { name: "code-execution", path: "/docs/tools/code-execution" },
  { name: "canvas", path: "/docs/tools/canvas" },
  { name: "conversations", path: "/docs/core/conversations" },
  { name: "architecture", path: "/docs/core/architecture" },
  { name: "configuration", path: "/docs/core/configuration" },
  { name: "source-ownership", path: "/docs/core/source-ownership" },
  { name: "execution", path: "/docs/core/execution" },
  { name: "tool-calls", path: "/docs/core/tool-calls" },
  { name: "identity", path: "/docs/core/authentication" },
  { name: "authentication", path: "/docs/customization/authentication" },
  { name: "models", path: "/docs/customization/models" },
  { name: "credits", path: "/docs/plugins/credits" },
  { name: "desktop-distribution", path: "/docs/deployment/desktop" },
  { name: "desktop-releases", path: "/docs/reference/desktop-releases" },
  { name: "cli-sync", path: "/docs/cli/sync" },
  { name: "cli-remove", path: "/docs/cli/remove" },
  { name: "reasoning", path: "/docs/core/reasoning" },
] as const;

for (const page of pages) {
  test(`docs ${page.name}`, async () => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    document.body.style.margin = "0";

    const frame = document.createElement("iframe");
    frame.title = `ChatJS docs: ${page.name}`;
    const loaded = Promise.withResolvers<boolean>();
    frame.addEventListener(
      "load",
      () => {
        loaded.resolve(true);
      },
      { once: true }
    );
    frame.src = page.path;
    frame.style.cssText = "border:0;display:block;height:100vh;width:100vw";
    document.body.append(frame);

    await loaded.promise;

    const source = frame.contentDocument;
    if (!source) {
      throw new Error(`Unable to read ${page.path}`);
    }

    expect(source.querySelector("main")).not.toBeNull();

    const sections = source.querySelectorAll<HTMLDetailsElement>(
      "[data-blume-nav-tree] > ul > li > details"
    );
    expect(
      [...sections].map((section) =>
        section.querySelector("summary")?.textContent?.trim()
      )
    ).toEqual([
      "Get Started",
      "Concepts",
      "Models & Gateways",
      "Tools",
      "Plugins",
      "Customization",
      "Deployment",
      "Guides",
      "Reference",
    ]);

    if (page.name === "home") {
      const deployment = [...sections].find(
        (section) =>
          section
            .querySelector("summary")
            ?.textContent?.includes("Deployment") === true
      );
      expect(deployment?.open).toBe(false);
      deployment?.querySelector("summary")?.click();
      expect(deployment?.open).toBe(true);
      deployment?.querySelector("summary")?.click();
      expect(deployment?.open).toBe(false);
    }

    for (const image of source.images) {
      const still = stillFrames[image.getAttribute("src") ?? ""];
      if (still) {
        image.src = still;
      }
    }

    // The active page must remain discoverable inside collapsed navigation.
    const activeLink = source.querySelector("aside a[aria-current='page']");
    expect(activeLink).not.toBeNull();
    let ancestor = activeLink?.parentElement;
    while (ancestor) {
      if (ancestor.tagName === "DETAILS") {
        expect(ancestor.hasAttribute("open")).toBe(true);
      }
      ancestor = ancestor.parentElement;
    }

    for (const attribute of source.documentElement.attributes) {
      document.documentElement.setAttribute(attribute.name, attribute.value);
    }
    document.head.innerHTML = source.head.innerHTML;
    document.body.innerHTML = source.body.innerHTML;

    await Promise.all(
      [...document.images].map(
        async (image: Pick<HTMLImageElement, "decode">) => {
          await image.decode().catch(() => {
            // Keep capturing the page when an image fails to decode.
          });
        }
      )
    );
    await document.fonts.ready;
    await takeSnapshot(page.name);
  });
}
