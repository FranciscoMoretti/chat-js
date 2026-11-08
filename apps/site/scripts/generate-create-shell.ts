// Native shell components are generated upstream rather than checked into Git.
// Refresh from the public registry without changing their implementation.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getRegistryItems } from "shadcn/registry";

const destination = fileURLToPath(
  new URL("../vendor/shadcn-create/styles/base-nova/ui/", import.meta.url)
);
const requested = process.argv.slice(2);
const names = new Set(
  requested.length
    ? requested
    : [
        "button",
        "card",
        "field",
        "dialog",
        "drawer",
        "input",
        "command",
        "alert-dialog",
        "skeleton",
        "radio-group",
        "switch",
        "checkbox",
        "tabs",
        "toggle-group",
        "select",
        "scroll-area",
        "badge",
        "popover",
        "alert",
      ]
);
const previous = requested.length
  ? z
      .object({ sha256: z.record(z.string(), z.string()) })
      .parse(
        JSON.parse(
          await readFile(path.join(destination, "provenance.json"), "utf-8")
        )
      )
  : { sha256: {} };
const hashes: Record<string, string> = previous.sha256;
const done = new Set(
  Object.keys(hashes).filter((name) => !requested.includes(name))
);
await mkdir(destination, { recursive: true });
const fetchComponents = async (): Promise<void> => {
  const pending = [...names].filter((name) => !done.has(name));
  if (pending.length === 0) {
    return;
  }
  const items = await getRegistryItems(
    pending.map(
      (name) => `https://ui.shadcn.com/r/styles/base-nova/${name}.json`
    )
  );
  await Promise.all(
    items.map(async (item) => {
      const source = item.files?.find((file) =>
        file.path.endsWith(`/${item.name}.tsx`)
      )?.content;
      if (source === undefined || source.length === 0) {
        throw new Error(`Missing native ${item.name} source`);
      }
      hashes[item.name] = createHash("sha256").update(source).digest("hex");
      const content = source
        .replaceAll(
          /@\/(?:registry\/[^/]+|components)\/ui\/(?<name>[a-z-]+)/gu,
          (_match: string, name: string) => {
            names.add(name);
            return `./${name}`;
          }
        )
        .replaceAll(
          "@/app/(create)/components/icon-placeholder",
          "@/components/create-preview/icon-placeholder"
        );
      await writeFile(path.join(destination, `${item.name}.tsx`), content);
      done.add(item.name);
    })
  );
  await fetchComponents();
};
await fetchComponents();
await writeFile(
  path.join(destination, "provenance.json"),
  `${JSON.stringify({ source: "https://ui.shadcn.com/r/styles/base-nova", sha256: hashes }, null, 2)}\n`
);
