import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { PackageManager } from "#cli/types";
import { scaffoldFromTemplate } from "./scaffold";
import { initializeShadcn, runNativeShadcn } from "./initialize-shadcn";
import { parseJsonObject, requireJsonObject } from "./json-object";
import { prepareScaffoldUi } from "./scaffold-ui";
import { cleanNativeLayoutImports } from "./native-layout";

const shellFiles = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  "app/layout.tsx",
  "vendor",
];
const nativeOwned = new Set([
  "components.json",
  "package.json",
  "app/globals.css",
  "app/layout.tsx",
  "lib/utils.ts",
  "hooks/use-mobile.ts",
]);

export const scaffoldNativeProject = async (
  cwd: string,
  packageManager: PackageManager,
  args: readonly string[]
): Promise<void> => {
  // Keep the core payload outside the framework root so native file discovery
  // never sees a preconfigured Base application or its primitives.
  const core = await mkdtemp(path.join(path.dirname(cwd), ".chatjs-core-"));
  try {
    await scaffoldFromTemplate(core, { packageManager });
    const config = parseJsonObject(
      await readFile(path.join(core, "components.json"), "utf-8"),
      "Template components.json"
    );
    await mkdir(path.join(cwd, "app"), { recursive: true });
    const frameworkFiles =
      packageManager === "pnpm"
        ? [...shellFiles, "pnpm-workspace.yaml"]
        : shellFiles;
    await Promise.all(
      frameworkFiles.map(async (file) => {
        await cp(path.join(core, file), path.join(cwd, file), {
          recursive: true,
        });
      })
    );
    await writeFile(
      path.join(cwd, "app/globals.css"),
      '@import "tailwindcss";\n@import "./chatjs.css";\n'
    );
    // The additive application layer contains no native theme/font tokens.
    await cp(
      path.join(core, "app/chatjs.css"),
      path.join(cwd, "app/chatjs.css")
    );
    await initializeShadcn(cwd, args);
    const primitiveFiles = await readdir(path.join(core, "components/ui"), {
      withFileTypes: true,
    });
    const primitives = primitiveFiles
      .filter((file) => file.isFile() && file.name.endsWith(".tsx"))
      .map((file) => file.name.slice(0, -4));
    await runNativeShadcn(cwd, ["add", "--yes", "--overwrite", ...primitives]);
    // Native owns its generated config, CSS, fonts, utilities and primitives.
    // Compositions are copied only after that stage has completed successfully.
    await cp(core, cwd, {
      recursive: true,
      filter: (file) => {
        const relative = path.relative(core, file).split(path.sep).join("/");
        return (
          !nativeOwned.has(relative) &&
          !/^components\/ui\/[^/]+\.tsx$/u.test(relative)
        );
      },
    });
    const layoutPath = path.join(cwd, "app/layout.tsx");
    await writeFile(
      layoutPath,
      cleanNativeLayoutImports(await readFile(layoutPath, "utf-8"))
    );
    const lintPath = path.join(cwd, "oxlint.config.ts");
    const lint = await readFile(lintPath, "utf-8");
    await writeFile(
      lintPath,
      lint.replace(
        "  ignorePatterns: [",
        '  ignorePatterns: [\n    // Preserve the native shadcn hook, like its UI primitives.\n    "hooks/use-mobile.ts",'
      )
    );
    const configPath = path.join(cwd, "components.json");
    const native = parseJsonObject(
      await readFile(configPath, "utf-8"),
      "Native components.json"
    );
    native.registries = {
      ...requireJsonObject(native.registries ?? {}, "Native registries"),
      ...requireJsonObject(config.registries, "ChatJS registries"),
    };
    await writeFile(configPath, `${JSON.stringify(native, null, 2)}\n`);
    await prepareScaffoldUi(cwd);
  } finally {
    await rm(core, { recursive: true, force: true });
  }
};
