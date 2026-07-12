import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type RegistryFile = {
  content: string;
  target: string;
  type: "component" | "hook" | "lib" | "renderer" | "tool" | "ui";
};

type RegistryItem = {
  files: RegistryFile[];
  name: string;
  projectRequirements?: string[];
  registryDependencies?: string[];
};

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, "../..");
const itemsDir = join(packageDir, "items");
const toolsDir = join(repoRoot, "apps/chat/tools/chatjs");
const uiDir = join(repoRoot, "apps/chat/components/ui");
const bundledItems = new Set([
  "generate-image",
  "generate-video",
  "get-weather",
  "retrieve-url",
  "toolkit-renderer",
  "word-count",
]);

function renderForChatApp(content: string): string {
  return content
    .replace(
      /(["'])@toolkit\/(lib|components|hooks)\/([^"'`]+)\1/g,
      (_match, quote: string, kind: string, rest: string) =>
        `${quote}@/tools/chatjs/_shared/${kind}/${rest}${quote}`
    )
    .replace(
      /(["'])@ui\/([^"'`]+)\1/g,
      (_match, quote: string, rest: string) =>
        `${quote}@/components/ui/${rest}${quote}`
    );
}

async function readRegistryItems(): Promise<RegistryItem[]> {
  const files = (await readdir(itemsDir)).filter((file) =>
    file.endsWith(".json")
  );
  return await Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(join(itemsDir, file), "utf8"))
    )
  );
}

describe("registry integrity", () => {
  it("keeps bundled ChatJS files synchronized with published registry items", async () => {
    for (const item of await readRegistryItems()) {
      if (!bundledItems.has(item.name)) {
        continue;
      }
      for (const file of item.files) {
        const rootDir = file.type === "ui" ? uiDir : toolsDir;
        const installed = await readFile(join(rootDir, file.target), "utf8");
        expect(installed, `${item.name}:${file.target}`).toBe(
          renderForChatApp(file.content)
        );
      }
    }
  });

  it("declares registry-owned imports in each item", async () => {
    for (const item of await readRegistryItems()) {
      const content = item.files.map((file) => file.content).join("\n");

      if (content.includes("@toolkit/")) {
        expect(item.registryDependencies, item.name).toContain(
          "toolkit-renderer"
        );
      }

      for (const match of content.matchAll(/@ui\/([^"'`]+)/g)) {
        const target = `${match[1]}.tsx`;
        expect(
          item.files.some(
            (file) => file.type === "ui" && file.target === target
          ),
          `${item.name}:${target}`
        ).toBe(true);
      }
    }
  });

  it("declares storage setup for tools that write media", async () => {
    for (const item of await readRegistryItems()) {
      const toolContent = item.files
        .filter((file) => file.type === "tool")
        .map((file) => file.content)
        .join("\n");

      if (toolContent.includes('"media.write"')) {
        expect(item.projectRequirements, item.name).toContain("storage");
      }
    }
  });
});
