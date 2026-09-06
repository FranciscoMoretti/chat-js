// Disposable installation/composition spike. These are NOT M07 runtime APIs.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "m08-registry-"));
const file = (target: string, content: string) => ({
  path: target, type: "registry:file", target: `~/${target}`, content,
});
const item = (name: string, files: ReturnType<typeof file>[], dependencies: string[] = [], registryDependencies: string[] = []) => ({
  $schema: "https://ui.shadcn.com/schema/registry-item.json", name,
  type: "registry:item", files, dependencies, registryDependencies,
});
const items = {
  core: item("core", [
    file("lib/config.ts", `export function defineConfig<const T>(config: T): T { return config; }\n`),
    file("components/chat/layouts/minimal.ts", `export default function Layout() { return "minimal"; }\n`),
  ]),
  provider: item("provider", [file("lib/provider.ts", `import { createOpenAI } from "@ai-sdk/openai";\nexport const provider = createOpenAI;\n`)], ["@ai-sdk/openai@4.0.59"]),
  weather: item("weather", [
    file("tools/weather/contract.ts", `import { z } from "zod";\nexport const output = z.object({ celsius: z.number() });\nexport type Output = z.infer<typeof output>;\n`),
    file("tools/weather/server.ts", `import type { Output } from "./contract";\nexport function weather(): Output { return { celsius: 20 }; }\n`),
    file("tools/weather/client.ts", `import { output } from "./contract";\nexport const companion = { parse: (value: unknown) => output.parse(value), load: () => import("./renderer") };\n`),
    file("tools/weather/renderer.ts", `import type { Output } from "./contract";\nexport default function render(value: Output) { return value.celsius.toFixed(1); }\n`),
  ], ["zod@4.3.6"]),
  editor: item("editor", [file("components/editors/sheet.ts", `import Papa from "papaparse";\nexport const parse = Papa.parse;\n`)], ["papaparse@5.5.3", "@types/papaparse@5.3.16"]),
  alternative: item("alternative", [file("lib/alternative-provider.ts", `export const providerName = "unselected-provider";\n`)], ["@ai-sdk/openai-compatible@3.0.44"]),
  wide: item("wide", [file("components/chat/layouts/wide.ts", `export default function Layout() { return "wide"; }\n`)]),
};
const server = Bun.serve({ port: 0, fetch(request) {
  const name = new URL(request.url).pathname.replace(/^\/r\//, "").replace(/\.json$/, "");
  if (name === "bundle") return Response.json(item("bundle", [], [], [address("weather"), address("editor")]));
  if (!Object.hasOwn(items, name)) return new Response("not found", { status: 404 });
  return Response.json(items[name as keyof typeof items]);
} });
function address(name: string) { return `${server.url.origin}/r/${name}.json`; }
async function run(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  assert.equal(code, 0, `${command.join(" ")}\n${stdout}\n${stderr}`);
  return stdout;
}
async function write(cwd: string, path: string, content: string) {
  await mkdir(dirname(join(cwd, path)), { recursive: true });
  await writeFile(join(cwd, path), content);
}
async function inventory(cwd: string) {
  const entries = await readdir(cwd, { recursive: true });
  const files = entries.filter(p => !p.startsWith("node_modules") && /\.(ts|json|lock)$/.test(p)).sort();
  const manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
  return { files, dependencies: manifest.dependencies ?? {} };
}
// Proposed application-semantic validation, not an upstream resolver.
function requireServices(requirements: string[], choices: { slot: string; address: string }[]) {
  const selected = new Map<string, string>();
  for (const choice of choices) {
    if (selected.has(choice.slot) && selected.get(choice.slot) !== choice.address) throw Error(`Conflicting ${choice.slot}`);
    selected.set(choice.slot, choice.address);
  }
  for (const slot of requirements) if (!selected.has(slot)) throw Error(`Missing ${slot}`);
  return selected;
}
try {
  assert.throws(() => requireServices(["files"], []), /Missing files/);
  assert.throws(() => requireServices(["files"], [{slot:"files",address:"a"},{slot:"files",address:"b"}]), /Conflicting files/);
  assert.equal(requireServices(["files", "files"], [{slot:"files",address:"a"}]).size, 1);
  const results: Record<string, Awaited<ReturnType<typeof inventory>>> = {};
  for (const variant of ["minimal", "expanded"] as const) {
    const cwd = join(root, variant);
    await mkdir(cwd);
    await write(cwd, "package.json", JSON.stringify({ name: `m08-${variant}`, private: true, packageManager: `bun@${Bun.version}`, devDependencies: { typescript: "6.0.2", "@types/node": "26.4.1" } }));
    await write(cwd, "tsconfig.json", JSON.stringify({compilerOptions:{strict:true,noEmit:true,module:"ESNext",moduleResolution:"Bundler",target:"ES2022",skipLibCheck:true},include:["**/*.ts"]}));
    const selection = { items: [address("core"),address("provider"), ...(variant === "expanded" ? [address("bundle")] : [])], initialSettings: { model: "gpt-5-mini", actions: ["copy"] } };
    const shared = Buffer.from(JSON.stringify(selection)).toString("base64url");
    assert.deepEqual(JSON.parse(Buffer.from(shared, "base64url").toString()), selection);
    await write(cwd, "chat.selection.json", JSON.stringify(selection, null, 2));
    await run(["bun", join(import.meta.dir, "node_modules/shadcn/dist/index.js"), "add", ...selection.items, "--yes", "--cwd", cwd], cwd);
    await write(cwd, "chat.config.ts", `import {defineConfig} from "./lib/config";\nimport {provider} from "./lib/provider";\nexport default defineConfig({ model: provider()(${JSON.stringify(selection.initialSettings.model)}), messageActions: ["copy"] });\n`);
    await write(cwd, "components/chat/app-layout.ts", `export { default } from "./layouts/minimal";\n// Developer's local customization\n`);
    if (variant === "expanded") {
      await write(cwd, "chat.client.ts", `import { companion } from "./tools/weather/client";\nexport const renderers = { publicSearch__weather: companion, internalSearch__weather: companion };\nexport type MountedTool = keyof typeof renderers;\n`);
      await write(cwd, "type-proof.ts", `import { renderers, type MountedTool } from "./chat.client";\nconst valid: MountedTool = "publicSearch__weather";\n// @ts-expect-error unknown mount must fail\nconst invalid: MountedTool = "weather";\nconst output = renderers[valid].parse({ celsius: 20 });\nconst celsius: number = output.celsius;\n// @ts-expect-error output inference must reject strings\nconst wrong: string = output.celsius;\nvoid [invalid, celsius, wrong];\n`);
    }
    await run(["bunx", "tsc", "--noEmit"], cwd);
    results[variant] = await inventory(cwd);
    assert(!results[variant].files.includes("lib/alternative-provider.ts"));
    assert(!Object.hasOwn(results[variant].dependencies, "@ai-sdk/openai-compatible"));
    const lock = await readFile(join(cwd, "bun.lock"), "utf8");
    assert(!lock.includes('"@ai-sdk/openai-compatible"'));
    if (variant === "minimal") {
      assert(!results.minimal.files.some(p => p.startsWith("tools/") || p.startsWith("components/editors/")));
      assert(!Object.hasOwn(results.minimal.dependencies, "papaparse"));
      assert(!lock.includes('"papaparse"'));
      const before = await readFile(join(cwd, "components/chat/app-layout.ts"), "utf8");
      await run(["bun", join(import.meta.dir, "node_modules/shadcn/dist/index.js"), "add", address("wide"), "--yes", "--cwd", cwd], cwd);
      assert.equal(await readFile(join(cwd, "components/chat/app-layout.ts"), "utf8"), before);
      await write(cwd, "components/chat/app-layout.proposed.ts", `export { default } from "./layouts/wide";\n`);
      const diff = Bun.spawn(["git", "diff", "--no-index", "components/chat/app-layout.ts", "components/chat/app-layout.proposed.ts"], {cwd,stdout:"pipe",stderr:"pipe"});
      const output = await new Response(diff.stdout).text();
      assert.equal(await diff.exited, 1);
      assert(output.includes("Developer's local customization"));
      await run(["bunx", "tsc", "--noEmit"], cwd);
      await writeFile(join(import.meta.dir, "layout-replacement.diff"), output);
    }
  }
  assert(results.expanded.files.includes("tools/weather/server.ts"));
  assert(results.expanded.files.includes("tools/weather/renderer.ts"));
  assert(results.expanded.files.includes("components/editors/sheet.ts"));
  const evidence = {scope:"Installation/composition fixture only; expanded is NOT the full ChatJS demo or an Eve runtime", bun:Bun.version, shadcn:"4.21.0", results, checks:["selection JSON round-trip", "shared requirement reused; missing/conflicting rejected", "selected source/dependency and lock inventory", "unselected provider absent in both", "minimal tool/editor source absent", "strict generated TypeScript including negative mounted/output cases", "new layout installed while customized composition preserved", "reviewable replacement diff"]};
  await writeFile(join(import.meta.dir, "evidence.json"), JSON.stringify(evidence, null, 2)+"\n");
  console.log(JSON.stringify(evidence, null, 2));
} finally { server.stop(true); await rm(root, {recursive:true,force:true}); }
