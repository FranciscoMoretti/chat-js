import { expect, test } from "vitest";
import { takeSnapshot } from "@uiverify/vitest";

const pages = [
  { name: "plugin-concept", path: "/docs/core/plugins" },
  { name: "plugin-authoring", path: "/docs/cookbook/create-plugin" },
  { name: "mcp-plugin", path: "/docs/plugins/mcp" },
  { name: "attachments-plugin", path: "/docs/plugins/attachments" },
  { name: "analytics-plugin", path: "/docs/plugins/vercel-analytics" },
  {
    name: "speed-insights-plugin",
    path: "/docs/plugins/vercel-speed-insights",
  },
  { name: "langfuse-plugin", path: "/docs/plugins/langfuse" },
  { name: "followup-recipe", path: "/docs/cookbook/follow-up-questions" },
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
