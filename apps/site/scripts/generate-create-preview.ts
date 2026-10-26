// Regenerate native source: bun apps/site/scripts/generate-create-preview.ts
// Only import destinations are adapted. shadcn owns every component and menu transform.
import sitePackage from "../package.json";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRESET_MENU_COLORS, PRESET_STYLES } from "shadcn/preset";
import { getRegistryItems } from "shadcn/registry";
import { configSchema } from "shadcn/schema";
import { transformMenu } from "shadcn/utils";
import { Project } from "ts-morph";

const destination = fileURLToPath(
  new URL("../components/create-preview/ui/", import.meta.url)
);
const base = process.argv[2] ?? "base";
if (base !== "base" && base !== "radix") {
  throw new Error("Preview base must be base or radix.");
}
const styles = await Promise.all(
  PRESET_STYLES.map(async (style) => {
    const imports: string[] = [];
    const directory = base === "base" ? style : `radix-${style}`;
    const names = [
      "button",
      "input",
      "textarea",
      "input-group",
      "dropdown-menu",
      "message",
      "bubble",
      "attachment",
      "message-scroller",
      "collapsible",
      "trace",
      "code-block",
    ];
    const urls = names.map(
      (name) => `https://ui.shadcn.com/r/styles/${base}-${style}/${name}.json`
    );
    const items = await getRegistryItems(urls);
    const hashes = await Promise.all(
      items.map(async (item) => {
        const source = item.files?.find((file) =>
          file.path.endsWith(`/${item.name}.tsx`)
        )?.content;
        if (source === undefined || source.length === 0) {
          throw new Error(`Missing ${style}/${item.name} source`);
        }
        const hash = createHash("sha256").update(source).digest("hex");
        const adapted = source
          .replaceAll(/@\/registry\/[^/]+\/ui\/(?<name>[a-z-]+)/gu, "./$<name>")
          .replaceAll(/@\/components\/ui\/(?<name>[a-z-]+)/gu, "./$<name>")
          .replaceAll(
            "@/app/(create)/components/icon-placeholder",
            "../../icons"
          );
        const outputs =
          item.name === "dropdown-menu" ? PRESET_MENU_COLORS : [null];
        await Promise.all(
          outputs.map(async (menuColor) => {
            let content = adapted;
            const suffix = menuColor ? `-${menuColor}` : "";
            if (menuColor) {
              const project = new Project({ useInMemoryFileSystem: true });
              const sourceFile = project.createSourceFile(
                "dropdown-menu.tsx",
                adapted
              );
              const config = configSchema.parse({
                style: `${base}-${style}`,
                menuColor,
                tailwind: { css: "globals.css", baseColor: "neutral" },
                aliases: { components: ".", utils: "cn" },
                resolvedPaths: Object.fromEntries(
                  [
                    "components",
                    "ui",
                    "utils",
                    "lib",
                    "hooks",
                    "cwd",
                    "tailwindConfig",
                    "tailwindCss",
                  ].map((name) => [name, "."])
                ),
              });
              await transformMenu({
                filename: "dropdown-menu.tsx",
                raw: adapted,
                sourceFile,
                config,
              });
              content = sourceFile.getFullText();
            }
            const filename = path.join(
              destination,
              directory,
              `${item.name}${suffix}.tsx`
            );
            await mkdir(path.dirname(filename), { recursive: true });
            await writeFile(
              filename,
              `// Generated from shadcn registry; run scripts/generate-create-preview.ts.\n${content}`
            );
          })
        );
        return [`${style}/${item.name}`, hash] satisfies [string, string];
      })
    );
    imports.push(
      `import { Button as ${style}Button } from "./${directory}/button";`,
      `import * as ${style}InputGroup from "./${directory}/input-group";`,
      `import * as ${style}Message from "./${directory}/message";`,
      `import * as ${style}Bubble from "./${directory}/bubble";`,
      `import * as ${style}Attachment from "./${directory}/attachment";`,
      `import * as ${style}Scroller from "./${directory}/message-scroller";`,
      `import * as ${style}Trace from "./${directory}/trace";`,
      `import * as ${style}CodeBlock from "./${directory}/code-block";`
    );
    const menus = PRESET_MENU_COLORS.map((menuColor, index) => {
      imports.push(
        `import * as ${style}Menu${index} from "./${directory}/dropdown-menu-${menuColor}";`
      );
      return `${JSON.stringify(menuColor)}: ${style}Menu${index}`;
    });
    return {
      imports,
      hashes,
      entry: `${style}: { Button: ${style}Button, ...${style}InputGroup, ...${style}Message, ...${style}Bubble, ...${style}Attachment, ...${style}Scroller, ...${style}Trace, ...${style}CodeBlock, menus: { ${menus.join(", ")} } }`,
    };
  })
);
await writeFile(
  path.join(destination, base === "base" ? "native.ts" : "native-radix.ts"),
  `// Generated native preview variants.\n${styles.flatMap((style) => style.imports).join("\n")}\nexport const native = {\n${styles.map((style) => style.entry).join(",\n")}\n};\n`
);
await writeFile(
  path.join(
    destination,
    base === "base" ? "provenance.json" : "provenance-radix.json"
  ),
  `${JSON.stringify({ cli: sitePackage.dependencies.shadcn, base, source: "https://ui.shadcn.com/r/styles", sha256: Object.fromEntries(styles.flatMap((style) => style.hashes)) }, null, 2)}\n`
);
