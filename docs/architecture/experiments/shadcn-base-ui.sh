#!/usr/bin/env bash
# W0 bounded experiment. All dependencies and generated UI live outside the repo.
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
spike_root="$(mktemp -d "${TMPDIR:-/tmp}/chatjs-base-ui.XXXXXX")"
export CHATJS_SPIKE_REPO="$repo_root"
export CHATJS_SPIKE_ROOT="$spike_root"
printf 'Experiment directory: %s\n' "$spike_root"
git clone --quiet https://github.com/shadcn-ui/chatbot-template.git "$spike_root/upstream"
git -C "$spike_root/upstream" checkout --quiet 4106041b1bc9bab44e81ffd2764aa2b6f100e2b0
mkdir -p "$spike_root/app" "$spike_root/lib" "$spike_root/src" "$spike_root/tests" "$spike_root/evidence"
cp "$spike_root/upstream/components.json" "$spike_root/components.json"
cp "$spike_root/upstream/app/globals.css" "$spike_root/app/globals.css"
cp "$spike_root/upstream/app/typeset.css" "$spike_root/app/typeset.css"
cp "$spike_root/upstream/lib/utils.ts" "$spike_root/lib/utils.ts"
cd "$spike_root"
cat > 'package.json' <<'CHATJS_FIXTURE_EOF'
{
  "name": "chatjs-w0-base-experiment",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "test": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "1.8.0",
    "@fontsource/geist": "5.2.8",
    "@shadcn/react": "^0.3.1",
    "class-variance-authority": "0.7.1",
    "cn": "0.4.0",
    "lucide-react": "1.48.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "shadcn": "4.21.0",
    "shiki": "^4.5.0",
    "sonner": "2.0.7",
    "tailwindcss": "4.3.1",
    "tw-animate-css": "1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.3.1",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@types/node": "24.10.0",
    "@playwright/test": "1.59.1",
    "vite": "7.3.1",
    "typescript": "6.0.2"
  }
}

CHATJS_FIXTURE_EOF
cat > 'tsconfig.json' <<'CHATJS_FIXTURE_EOF'
{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"bundler","jsx":"react-jsx","strict":true,"skipLibCheck":true,"noEmit":true,"allowImportingTsExtensions":true,"types":["vite/client","node"],"paths":{"@/*":["./*"]}},"include":["**/*.ts","**/*.tsx"],"exclude":["upstream","node_modules"]}

CHATJS_FIXTURE_EOF
cat > 'vite.config.ts' <<'CHATJS_FIXTURE_EOF'
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({ plugins: [tailwindcss()], resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } } });

CHATJS_FIXTURE_EOF
cat > 'index.html' <<'CHATJS_FIXTURE_EOF'
<!doctype html><html lang="en"><head><title>ChatJS Base UI feasibility</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>

CHATJS_FIXTURE_EOF
cat > 'src/main.tsx' <<'CHATJS_FIXTURE_EOF'
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {Toaster} from "sonner";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-500.css";
import "../app/globals.css";
import {Button, buttonVariants} from "@/components/ui/button";
import {Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose, DialogHeader} from "@/components/ui/dialog";
import {DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup} from "@/components/ui/dropdown-menu";
import {Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem} from "@/components/ui/select";
import * as Original from "./controls-original";
import * as Migrated from "./controls-migrated";
const params = new URLSearchParams(location.search);
document.documentElement.style.setProperty("--font-sans", "Geist");
if(params.has("dark")) document.documentElement.classList.add("dark");
const Controls = params.has("original") ? Original : Migrated;
function App() {
 const [count,setCount] = useState(0);
 const [model,setModel] = useState<string|null>("fast");
 const [attachment,setAttachment] = useState("none");
 const disabled = params.has("disabled");
 const onAttach = (accept: string,capture?: string) => setAttachment(`${accept}|${capture ?? "file"}`);
 return <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
 <h1 className="text-xl font-medium">ChatJS · Base UI feasibility</h1>
 <p className="text-muted-foreground">Rhea · neutral · Geist · unchanged upstream primitives</p>
 <div className="flex flex-wrap gap-2">
 <Button onClick={()=>setCount(count+1)}>Send {count}</Button>
 <Button variant="outline">Outline</Button><Button disabled>Disabled</Button>
 <a href="#evidence" className={buttonVariants({variant:"link"})}>Evidence link</a>
 </div>
 <Dialog><DialogTrigger render={<Button variant="outline" />}>Open settings</DialogTrigger>
 <DialogContent><DialogHeader><DialogTitle>Chat settings</DialogTitle><DialogDescription>Focus, keyboard, and trigger composition.</DialogDescription></DialogHeader><DialogClose render={<Button />}>Done</DialogClose></DialogContent></Dialog>
 <Select items={[{value:"fast",label:"Fast model"},{value:"reasoning",label:"Reasoning model"}]} value={model} onValueChange={setModel}>
 <SelectTrigger aria-label="Model"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="fast">Fast model</SelectItem><SelectItem value="reasoning">Reasoning model</SelectItem></SelectGroup></SelectContent></Select>
 <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}>Add attachment</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuGroup><Controls.AttachFilesControl disabled={disabled} onAttach={onAttach}/><Controls.TakePhotoControl disabled={disabled} onAttach={onAttach}/></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
 <div id="evidence" className="flex flex-col gap-2 rounded-xl border p-4"><p>Selected model: <output data-testid="model">{model}</output></p><p>Attachment: <output data-testid="attachment">{attachment}</output></p><p>Plugin mode: {params.has("original") ? "original onSelect" : "migrated onClick"}</p></div>
 <Toaster />
 </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);

CHATJS_FIXTURE_EOF
cat > 'playwright.config.ts' <<'CHATJS_FIXTURE_EOF'
import {defineConfig} from "@playwright/test";
export default defineConfig({testDir: "./tests", workers:1, use:{baseURL:"http://127.0.0.1:5197", viewport:{width:960,height:900}, contextOptions:{reducedMotion:"reduce"}}, webServer:{command:"bun run dev --port 5197 --strictPort", url:"http://127.0.0.1:5197", reuseExistingServer:false}, reporter:"list"});

CHATJS_FIXTURE_EOF
cat > 'tests/base.spec.ts' <<'CHATJS_FIXTURE_EOF'
import {test, expect} from "@playwright/test";

test("Base primitives retain click, link, focus return and keyboard selection", async ({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:"Send 0",exact:true}).click();
 await expect(page.getByRole("button",{name:"Send 1",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Disabled",exact:true})).toBeDisabled();
 await expect(page.getByRole("link",{name:"Evidence link"})).toHaveAttribute("href","#evidence");
 await page.getByRole("button",{name:"Open settings"}).click();
 await expect(page.getByRole("dialog",{name:"Chat settings"})).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(page.getByRole("dialog")).toBeHidden();
 await expect(page.getByRole("button",{name:"Open settings"})).toBeFocused();
 await page.getByRole("combobox",{name:"Model"}).click();
 await page.getByRole("option",{name:"Reasoning model"}).click();
 await expect(page.getByTestId("model")).toHaveText("reasoning");
 await expect(page.getByRole("combobox",{name:"Model"})).toContainText("Reasoning model");
 await page.getByRole("combobox",{name:"Model"}).focus();
 await page.keyboard.press("ArrowDown");
 await page.keyboard.press("Home");
 await page.keyboard.press("Enter");
 await expect(page.getByTestId("model")).toHaveText("fast");
});

test("original plugin's Radix onSelect silently fails with Base Menu",async({page})=>{
 await page.goto("/?original");
 await page.getByRole("button",{name:"Add attachment"}).click();
 await page.getByRole("menuitem",{name:"Attach files"}).click();
 await expect(page.getByRole("menu")).toBeHidden();
 await expect(page.getByTestId("attachment")).toHaveText("none");
});

test("migrated plugin supports pointer and keyboard attachment callbacks",async({page})=>{
 await page.goto("/?mobile");
 await page.getByRole("button",{name:"Add attachment"}).click();
 await page.getByRole("menuitem",{name:"Attach files"}).click();
 await expect(page.getByTestId("attachment")).toHaveText("image/png,application/pdf|file");
 await page.getByRole("button",{name:"Add attachment"}).focus();
 await page.keyboard.press("ArrowDown");
 await page.keyboard.press("End");
 await page.keyboard.press("Enter");
 await expect(page.getByTestId("attachment")).toHaveText("image/jpeg,image/png|environment");
});

test("plugin preserves guest, disabled, desktop and uninstalled gates",async({page})=>{
 await page.goto("/?guest");
 await page.getByRole("button",{name:"Add attachment"}).click();
 await expect(page.getByRole("menuitem",{name:"Take photo"})).toHaveCount(0);
 await page.getByRole("menuitem",{name:"Attach files"}).click();
 await expect(page.getByText("Sign in to attach files")).toBeVisible();
 await expect(page.getByTestId("attachment")).toHaveText("none");
 await page.goto("/?disabled&mobile");
 await page.getByRole("button",{name:"Add attachment"}).click();
 await expect(page.getByRole("menuitem",{name:"Attach files"})).toBeDisabled();
 await expect(page.getByRole("menuitem",{name:"Take photo"})).toBeDisabled();
 await page.goto("/?uninstalled");
 await page.getByRole("button",{name:"Add attachment"}).click();
 await expect(page.getByRole("menuitem")).toHaveCount(0);
});

for(const mode of [{name:"desktop-light",width:960,height:900,query:"mobile"},{name:"mobile-dark",width:390,height:844,query:"mobile&dark"}]) {
 test(`visual evidence ${mode.name}`,async({page})=>{
  await page.setViewportSize({width:mode.width,height:mode.height});
  await page.goto(`/?${mode.query}`);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`evidence/${mode.name}-closed.png`,fullPage:true});
  await page.getByRole("combobox",{name:"Model"}).click();
  await expect(page.getByRole("option",{name:"Reasoning model"})).toBeVisible();
  await page.screenshot({path:`evidence/${mode.name}-select.png`,animations:"disabled",fullPage:true});
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Add attachment"}).click();
  await expect(page.getByRole("menuitem",{name:"Attach files"})).toBeVisible();
  await page.screenshot({path:`evidence/${mode.name}-menu.png`,animations:"disabled",fullPage:true});
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Open settings"}).click();
  await expect(page.getByRole("dialog",{name:"Chat settings"})).toBeVisible();
  await page.screenshot({path:`evidence/${mode.name}-dialog.png`,animations:"disabled",fullPage:true});
 });
}

CHATJS_FIXTURE_EOF
bun -e '
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";
const pluginPath = `${process.env.CHATJS_SPIKE_REPO}/packages/registry/src/plugins/attachment-uploads/src/controls.tsx`;
const source = readFileSync(pluginPath, "utf8");
writeFileSync("src/controls-original.tsx", source);
writeFileSync("src/controls-migrated.tsx", source.replaceAll("onSelect=", "onClick="));
writeFileSync("evidence/plugin-source-sha256.txt", new Bun.CryptoHasher("sha256").update(source).digest("hex"));
mkdirSync(dirname("components/composer/control.ts"), {recursive:true});
writeFileSync("components/composer/control.ts", "export type ComposerControlProps = { disabled?: boolean; onAttach: (accept: string, capture?: string) => void };");
mkdirSync(dirname("components/upgrade-cta/login-prompt.tsx"), {recursive:true});
writeFileSync("components/upgrade-cta/login-prompt.tsx", "export function LoginPrompt(props: {title: string; description: string}) { return <div>{props.title}</div>; }");
mkdirSync(dirname("composition/generated/installed.ts"), {recursive:true});
writeFileSync("composition/generated/installed.ts", "export const installedPlugins = new Set(new URLSearchParams(location.search).has(\"uninstalled\") ? [] : [\"attachment-uploads\"]);");
mkdirSync(dirname("hooks/use-mobile.ts"), {recursive:true});
writeFileSync("hooks/use-mobile.ts", "export const useIsMobile = () => new URLSearchParams(location.search).has(\"mobile\");");
mkdirSync(dirname("lib/config.ts"), {recursive:true});
writeFileSync("lib/config.ts", "export const config = {attachments: {acceptedTypes: {\"image/png\": true, \"application/pdf\": true}}};");
mkdirSync(dirname("providers/session-provider.ts"), {recursive:true});
writeFileSync("providers/session-provider.ts", "export const useSession = () => ({data: new URLSearchParams(location.search).has(\"guest\") ? null : {user: {id: \"fixture-user\"}}});");
'
bun install
bunx --bun shadcn@4.21.0 add button dialog dropdown-menu select message message-scroller bubble attachment trace code-block --yes
bunx --bun shadcn@4.21.0 info --json > evidence/shadcn-info.json
bun run typecheck
bun run test
printf 'Evidence and full generated sources: %s\n' "$spike_root"
