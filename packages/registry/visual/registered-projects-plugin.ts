/* oxlint-disable import/no-nodejs-modules -- This Vite loader runs on the Node host and reads the actual component source using native filesystem and URL APIs. */
import { readFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This Vite loader runs on the Node host and reads the actual component source using native filesystem and URL APIs. */
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { fileURLToPath } from "node:url";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

import ts from "typescript";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import type { Plugin } from "vite";
/* oxlint-enable sort-imports */

const virtualId = "@/tests/visual/registered-projects";
const resolvedId = "\0registered-projects.tsx";
/* oxlint-disable oxc/no-async-await -- The Vite host loader awaits native filesystem reads before compiling the current private server initializer. */
const getRegisteredInitializer = async (): Promise<string> => {
  const file = fileURLToPath(
    new URL("../../../apps/chat/components/app-sidebar.tsx", import.meta.url)
  );
  const source = ts.createSourceFile(
    file,
    await readFile(file, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "RegisteredEveProjects" &&
          declaration.initializer
        ) {
          return declaration.initializer.getText(source);
        }
      }
    }
  }
  throw new Error("Actual RegisteredEveProjects initializer absent");
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- The Vite host loader awaits native filesystem reads before compiling the current private server initializer. */
const loadRegisteredProjects = async (): Promise<string> => {
  const initializer = await getRegisteredInitializer();
  const source = `import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from "@/components/ui/sidebar";
import { SidebarProjects } from "@/components/sidebar-projects";
import { fixtureAuth as auth, fixtureHeaders as headers } from "@/tests/visual/native-eve-services";
export const RegisteredEveProjects = ${initializer};`;
  return ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- The Vite host loader awaits native filesystem reads before compiling the current private server initializer. */
const registeredProjectsPlugin = (): Plugin => ({
  async load(id: string): Promise<string | undefined> {
    if (id === resolvedId) {
      return await loadRegisteredProjects();
    }
    /* oxlint-disable eslint/no-undefined -- Vite resolve/load hooks return undefined when this virtual-module plugin does not handle the requested ID. */
    return undefined;
    /* oxlint-enable eslint/no-undefined */
  },
  name: "registered-projects-server-fixture",
  resolveId(id: string): string | undefined {
    if (id === virtualId || id.endsWith("/tests/visual/registered-projects")) {
      return resolvedId;
    }
    /* oxlint-disable eslint/no-undefined -- Vite resolve/load hooks return undefined when this virtual-module plugin does not handle the requested ID. */
    return undefined;
    /* oxlint-enable eslint/no-undefined */
  },
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable import/no-named-export -- Keep the named fixture bindings (registeredProjectsPlugin); enabled import/no-default-export requires a named module API. */
/* oxlint-disable import/prefer-default-export -- The visual config consumes this named plugin factory; enabled import/no-default-export rejects a default module API. */
export { registeredProjectsPlugin };
/* oxlint-enable import/prefer-default-export */
/* oxlint-enable import/no-named-export */
