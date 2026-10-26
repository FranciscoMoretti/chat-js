#!/usr/bin/env bash
# Reproduce W1 against the repository's installed shadcn CLI and public preset API.
# Requires bun install, Node >=24, and Playwright Chromium. All writes stay in a temp directory.
set -euo pipefail

CHATJS_REPO_ROOT="$(git rev-parse --show-toplevel)"
CHATJS_EXPERIMENT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/chatjs-create-contract.XXXXXX")"
export CHATJS_REPO_ROOT CHATJS_EXPERIMENT_ROOT
echo "Experiment: $CHATJS_EXPERIMENT_ROOT"

cat > "$CHATJS_EXPERIMENT_ROOT/prepare.ts" <<'EOF'
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.env.CHATJS_REPO_ROOT!;
const root = process.env.CHATJS_EXPERIMENT_ROOT!;
const presetApi = Bun.resolveSync("shadcn/preset", repo);
const { encodePreset } = await import(pathToFileURL(presetApi).href);
const first = encodePreset({ style: "rhea", baseColor: "neutral", theme: "blue", font: "inter", radius: "small", iconLibrary: "lucide" });
const second = encodePreset({ style: "rhea", baseColor: "neutral", theme: "rose", font: "geist", radius: "large", iconLibrary: "lucide" });
await mkdir(path.join(root, "app/app"), { recursive: true });
const files = {
  "package.json": JSON.stringify({ name: "chatjs-native-preset-experiment", private: true, packageManager: "bun@1.3.11", dependencies: { next: "16.3.0", react: "19.2.3", "react-dom": "19.2.3", shadcn: "4.21.0", "lucide-react": "0.553.0", cn: "0.4.0", "tw-animate-css": "1.3.7" }, devDependencies: { tailwindcss: "4.2.2", "@tailwindcss/postcss": "4.2.2", typescript: "6.0.2", "@types/react": "19.2.7", "@types/node": "22.13.10" } }, null, 2),
  "next.config.mjs": "export default {};\n",
  "next-env.d.ts": '/// <reference types="next" />\n',
  "app/globals.css": '@import "tailwindcss";\n@import "tw-animate-css";\n',
  "app/layout.tsx": 'import "./globals.css";\nimport { Geist, Geist_Mono } from "next/font/google";\nconst fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" });\nconst fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });\nexport default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}><body>{children}</body></html> }\n',
  "app/page.tsx": 'export default function Page() { return <main>Native preset experiment</main> }\n',
  "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["dom", "esnext"], module: "esnext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true, paths: { "@/*": ["./*"] } }, include: ["**/*.ts", "**/*.tsx"] }, null, 2),
  "postcss.config.mjs": 'export default { plugins: { "@tailwindcss/postcss": {} } };\n',
};
for (const [name, content] of Object.entries(files)) await writeFile(path.join(root, "app", name), content);
await writeFile(path.join(root, "first-preset.txt"), first);
await writeFile(path.join(root, "second-preset.txt"), second);
const browser = `
import { encodePreset, PRESET_STYLES, PRESET_THEMES, PRESET_FONTS, PRESET_RADII, PRESET_ICON_LIBRARIES } from ${JSON.stringify(presetApi)};
import { installationSelectionSchema } from ${JSON.stringify(path.join(repo, "packages/registry/installation.ts"))};
export const selection = installationSelectionSchema.parse({ plugins: ["attachment-uploads"], gateway: "openrouter", storage: { source: "s3", options: { bucket: "uploads", region: "eu-west-2" } } });
export const rejectsThemeInInstallation = !installationSelectionSchema.safeParse({ preset: "unrelated" }).success;
export const preset = encodePreset({ style: "rhea", baseColor: "neutral", theme: "blue", font: "inter", radius: "small", iconLibrary: "lucide" });
export const choices = { styles: PRESET_STYLES, themes: PRESET_THEMES, fonts: PRESET_FONTS, radii: PRESET_RADII, icons: PRESET_ICON_LIBRARIES };
`;
await writeFile(path.join(root, "browser.ts"), browser);
EOF

bun "$CHATJS_EXPERIMENT_ROOT/prepare.ts"
bun build "$CHATJS_EXPERIMENT_ROOT/browser.ts" --target browser --minify --outfile "$CHATJS_EXPERIMENT_ROOT/browser.js"
cd "$CHATJS_EXPERIMENT_ROOT/app"
bun install > "$CHATJS_EXPERIMENT_ROOT/install.log" 2>&1
SHADCN_CLI="$CHATJS_REPO_ROOT/node_modules/shadcn/dist/index.js"
bun "$SHADCN_CLI" --version > "$CHATJS_EXPERIMENT_ROOT/cli-version.txt"
bun "$SHADCN_CLI" init --base radix --preset "$(cat "$CHATJS_EXPERIMENT_ROOT/first-preset.txt")" --yes --no-monorepo --no-rtl --pointer > "$CHATJS_EXPERIMENT_ROOT/init.log" 2>&1
bun "$SHADCN_CLI" preset resolve --json > "$CHATJS_EXPERIMENT_ROOT/initial-resolve.json"
bun "$SHADCN_CLI" add button --yes > "$CHATJS_EXPERIMENT_ROOT/add.log" 2>&1

cat > "$CHATJS_EXPERIMENT_ROOT/apply.ts" <<'EOF'
const root = process.env.CHATJS_EXPERIMENT_ROOT!;
const config = await Bun.file(`${root}/app/components.json`).json();
config.registries["@chatjs"] = "https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json";
await Bun.write(`${root}/app/components.json`, JSON.stringify(config, null, 2));
await Bun.write(`${root}/app/chat.config.ts`, 'export default { appName: "Preset experiment" };\n');
for (const [source, snapshot] of [["components/ui/button.tsx", "button.tsx"], ["app/layout.tsx", "layout.tsx"]]) {
  await Bun.write(`${root}/before-${snapshot}`, await Bun.file(`${root}/app/${source}`).text());
}
EOF
bun "$CHATJS_EXPERIMENT_ROOT/apply.ts"
bun "$SHADCN_CLI" apply "$(cat "$CHATJS_EXPERIMENT_ROOT/second-preset.txt")" --only theme --yes > "$CHATJS_EXPERIMENT_ROOT/apply.log" 2>&1
bun "$SHADCN_CLI" preset resolve --json > "$CHATJS_EXPERIMENT_ROOT/after-apply.json"
if bun "$SHADCN_CLI" apply not-a-real-preset --yes > "$CHATJS_EXPERIMENT_ROOT/invalid.log" 2>&1; then
  echo "Expected the native CLI to reject an invalid preset" >&2
  exit 1
fi
bunx tsc --noEmit > "$CHATJS_EXPERIMENT_ROOT/types.log" 2>&1

cat > "$CHATJS_EXPERIMENT_ROOT/verify.ts" <<'EOF'
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const root = process.env.CHATJS_EXPERIMENT_ROOT!;
const repo = process.env.CHATJS_REPO_ROOT!;
const initial = await Bun.file(`${root}/initial-resolve.json`).json();
assert.equal(initial.code, await Bun.file(`${root}/first-preset.txt`).text());
assert.deepEqual(initial.fallbacks, []);
const after = await Bun.file(`${root}/after-apply.json`).json();
assert.equal(after.values.theme, "rose");
assert.equal(after.values.radius, "large");
assert.equal(after.values.font, "inter");
assert.equal(await Bun.file(`${root}/before-button.tsx`).text(), await Bun.file(`${root}/app/components/ui/button.tsx`).text());
assert.equal(await Bun.file(`${root}/before-layout.tsx`).text(), await Bun.file(`${root}/app/app/layout.tsx`).text());
assert.equal(await Bun.file(`${root}/app/chat.config.ts`).text(), 'export default { appName: "Preset experiment" };\n');
const config = await Bun.file(`${root}/app/components.json`).json();
assert.equal(config.style, "radix-rhea");
assert.equal(config.registries["@chatjs"], "https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json");
assert.match(await Bun.file(`${root}/app/app/globals.css`).text(), /cursor: pointer/);
assert.match(await Bun.file(`${root}/invalid.log`).text(), /Invalid preset/);
const { chromium } = await import(pathToFileURL(`${repo}/node_modules/playwright/index.mjs`).href);
const browser = await chromium.launch({ headless: true });
let browserResult;
try {
  const page = await browser.newPage();
  await page.goto("about:blank");
  browserResult = await page.evaluate(async (source) => {
    const module = await import(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
    return { preset: module.preset, selection: module.selection, rejectsThemeInInstallation: module.rejectsThemeInInstallation, counts: Object.fromEntries(Object.entries(module.choices).map(([name, values]) => [name, values.length])) };
  }, await Bun.file(`${root}/browser.js`).text());
  assert.equal(browserResult.preset, initial.code);
  assert.equal(browserResult.rejectsThemeInInstallation, true);
  assert.deepEqual(browserResult.selection, { plugins: ["attachment-uploads"], gateway: "openrouter", storage: { options: { bucket: "uploads", region: "eu-west-2" }, source: "s3" }, tools: [] });
} finally {
  await browser.close();
}
const manifest = await Bun.file(`${root}/app/package.json`).json();
const result = {
  cliVersion: (await Bun.file(`${root}/cli-version.txt`).text()).trim(),
  generatedShadcnDependency: manifest.dependencies.shadcn,
  browser: browserResult,
  initialPreset: initial,
  themeOnlyPreset: after,
  checks: ["browser preset and installation inputs", "exact preset round trip", "native component installation", "theme-only update preserves font and component", "ChatJS registry and config preserved", "native pointer rule preserved", "native invalid-preset error", "generated fixture TypeScript"],
};
await Bun.write(`${root}/results.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
EOF
bun "$CHATJS_EXPERIMENT_ROOT/verify.ts"
echo "Evidence retained at $CHATJS_EXPERIMENT_ROOT"
