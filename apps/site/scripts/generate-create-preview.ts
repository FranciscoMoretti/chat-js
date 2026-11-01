// Sync the canonical preview from an immutable upstream commit.
// bun apps/site/scripts/generate-create-preview.ts [--check]
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformDirection } from "shadcn/utils";
import type { AtRule } from "postcss";
import { parse } from "postcss";
import sitePackage from "../package.json";

const commit = "481d523374745e77d0cf9c53a4115ab5dd7c8481";
const root = `https://raw.githubusercontent.com/shadcn-ui/ui/${commit}/apps/v4/`;
const destination = fileURLToPath(
  new URL("../components/create-preview/ui/", import.meta.url)
);
const names = [
  "scroll-area",
  "sidebar",
  "sheet",
  "separator",
  "skeleton",
  "tooltip",
  "direction",
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
const styles = ["vega", "nova", "lyra", "maia", "mira", "luma", "sera", "rhea"];
const bases = ["base", "radix"];
const hash = (source: string) =>
  createHash("sha256").update(source).digest("hex");
const files = new Map<string, string>();
const sources: Record<
  string,
  { source: string; sha256: string; adaptedSha256: string }
> = {};

const fetchSource = async (source: string) => {
  const response = await fetch(`${root}${source}`);
  if (!response.ok) {
    throw new Error(`Cannot import ${source}: HTTP ${response.status}`);
  }
  return await response.text();
};

// Use the same pinned shadcn RTL transform for component utilities and CSS
// @apply utilities. This preserves the old preview's logical spacing without
// creating a second component or stylesheet for RTL.
const logicalCss = async (source: string) => {
  const stylesheet = parse(source);
  const applies: AtRule[] = [];
  stylesheet.walkAtRules("apply", (rule) => {
    applies.push(rule);
  });
  if (applies.some((rule) => rule.params.includes('"'))) {
    throw new Error("Review quoted utilities before adapting upstream CSS.");
  }
  const jsx = `const Styles = () => <>${applies.map((rule) => `<div className="${rule.params}" />`).join("\n")}</>`;
  const transformed = await transformDirection(jsx, true);
  const classes = [
    ...transformed.matchAll(/className="(?<utilities>[^"]*)"/gu),
  ];
  if (classes.length !== applies.length) {
    throw new Error("The upstream RTL transform changed its output contract.");
  }
  for (const [index, rule] of applies.entries()) {
    const [, utilities] = classes[index];
    rule.params = utilities;
  }
  return stylesheet.toString();
};

await Promise.all(
  bases.flatMap((base) =>
    names.map(async (name) => {
      const source = `registry/bases/${base}/ui/${name}.tsx`;
      const original = await fetchSource(source);
      // Radix's controlled Sidebar has no SheetTrigger to restore focus to.
      // The preview contains exactly one sidebar trigger in this document.
      const focusable =
        base === "radix" && name === "sidebar"
          ? original.replace(
              "<SheetContent\n",
              `<SheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.querySelector<HTMLElement>('[data-sidebar="trigger"]')?.focus()
          }}
`
            )
          : original;
      const adapted = await transformDirection(
        focusable
          .replaceAll(
            `@/registry/bases/${base}/hooks/use-mobile`,
            "../../../../../chat/hooks/use-mobile"
          )
          .replaceAll(new RegExp(`@/registry/bases/${base}/ui/`, "gu"), "./")
          .replaceAll(
            "@/app/(create)/components/icon-placeholder",
            "../../icons"
          ),
        true
      );
      const filename = `${base}/${name}.tsx`;
      files.set(filename, adapted);
      sources[filename] = {
        source,
        sha256: hash(original),
        adaptedSha256: hash(adapted),
      };
    })
  )
);
await Promise.all(
  styles.map(async (style) => {
    const source = `registry/styles/style-${style}.css`;
    const original = await fetchSource(source);
    const adapted = await logicalCss(original);
    const filename = `styles/style-${style}.css`;
    files.set(filename, adapted);
    sources[filename] = {
      source,
      sha256: hash(original),
      adaptedSha256: hash(adapted),
    };
  })
);
const source = "app/style-registry.css";
const original = await fetchSource(source);
const adapted = original
  .replace("./globals.css", "../../../app/globals.css")
  .replaceAll("../registry/styles/", "./styles/");
files.set("style-registry.css", adapted);
sources["style-registry.css"] = {
  source,
  sha256: hash(original),
  adaptedSha256: hash(adapted),
};
for (const base of bases) {
  files.set(
    `${base}/index.ts`,
    `${names.map((name) => `export * from "./${name}"`).join("\n")}\n`
  );
}
files.set(
  "provenance.json",
  `${JSON.stringify(
    {
      repository: "https://github.com/shadcn-ui/ui",
      commit,
      rtlTransform: `shadcn@${sitePackage.dependencies.shadcn}`,
      adaptations: [
        "Local component, icon, and shared mobile hook import paths",
        "Upstream RTL transform on TSX and CSS @apply utilities",
        "Local stylesheet import and reference paths",
        "Restore Radix mobile sidebar focus to the preview trigger on close",
      ],
      files: Object.fromEntries(
        Object.entries(sources).toSorted(([a], [b]) => a.localeCompare(b))
      ),
    },
    null,
    2
  )}\n`
);

if (process.argv.includes("--check")) {
  const entries = await readdir(destination, {
    recursive: true,
    withFileTypes: true,
  });
  const actualFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(destination, path.join(entry.parentPath, entry.name))
    )
    .toSorted();
  if (
    JSON.stringify(actualFiles) !== JSON.stringify([...files.keys()].toSorted())
  ) {
    throw new Error(
      "Preview file inventory differs from the pinned import. Run the sync script."
    );
  }
  await Promise.all(
    [...files].map(async ([filename, content]) => {
      if (
        (await readFile(path.join(destination, filename), "utf-8")) !== content
      ) {
        throw new Error(`Pinned preview import differs: ${filename}`);
      }
    })
  );
  console.log(
    `Verified ${files.size} preview files against shadcn/ui@${commit}.`
  );
} else {
  // Fetch and adapt everything before replacing the generator-owned directory.
  await rm(destination, { recursive: true, force: true });
  await Promise.all(
    [...files].map(async ([filename, content]) => {
      const target = path.join(destination, filename);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    })
  );
  console.log(`Imported ${files.size} preview files from shadcn/ui@${commit}.`);
}
