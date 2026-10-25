import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const virtualId = "@/tests/visual/registered-projects";
const resolvedId = "\0registered-projects.tsx";
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
const loadRegisteredProjects = async (): Promise<string> => {
  const initializer = await getRegisteredInitializer();
  const source = `import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from "@/components/ui/sidebar";
import { SidebarProjects } from "@/plugins/projects/ui/sidebar-projects";
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
const registeredProjectsPlugin = (): Plugin => ({
  async load(id: string): Promise<string | undefined> {
    if (id === resolvedId) {
      return await loadRegisteredProjects();
    }
    return undefined;
  },
  name: "registered-projects-server-fixture",
  resolveId(id: string): string | undefined {
    if (id === virtualId || id.endsWith("/tests/visual/registered-projects")) {
      return resolvedId;
    }
    return undefined;
  },
});
export { registeredProjectsPlugin };
