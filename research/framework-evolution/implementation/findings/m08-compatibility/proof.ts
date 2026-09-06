// Research fixture only. Reads a pinned M07 commit; never edits its worktree.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const source = process.env.M07_SOURCE ?? "/Users/fran/.codex/worktrees/7f9a/chat-js";
const commit = "b4f11884371768836dc5d84498a477b1ed19a07b";
const prefix = "examples/minimal-next/";
const root = await mkdtemp(join(tmpdir(), "chatjs-compatibility-"));
async function run(command: string[], cwd: string, success = true) {
  const p = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([p.exited, new Response(p.stdout).text(), new Response(p.stderr).text()]);
  if (success) assert.equal(code, 0, `${command.join(" ")}\n${stdout}\n${stderr}`);
  return { code, stdout, stderr };
}
async function write(cwd: string, path: string, content: string) {
  await mkdir(dirname(join(cwd, path)), { recursive: true });
  await writeFile(join(cwd, path), content);
}
async function replace(cwd: string, path: string, before: string, after: string) {
  const text = await readFile(join(cwd, path), "utf8");
  assert(text.includes(before), `Source changed: ${path}`);
  await write(cwd, path, text.replace(before, after));
}
// Only application-semantic declarations. Not a package or registry resolver.
function validateSelection(selection: { host: string; provides: string[]; requires: string[]; conflictingSlots?: string[] }) {
  if (selection.host !== "node") throw Error("Eve example requires Node host");
  const present = new Set(selection.provides);
  for (const required of selection.requires) if (!present.has(required)) throw Error(`Missing ${required}`);
  if (selection.conflictingSlots?.length) throw Error(`Conflicting slot: ${selection.conflictingSlots.join(",")}`);
}
const contractTest = (issuer: string) => `import { test, expect } from "bun:test";
import { SignJWT } from "jose";
import { caller, sameOrigin } from "./lib/identity";
// Public fixture values, never loaded from an app env file.
process.env.APP_IDENTITY_SECRET = "fixture-only-identity-signing-key-never-use-outside-tests";
process.env.APP_ORIGIN = "https://fixture.invalid";
const key = new TextEncoder().encode(process.env.APP_IDENTITY_SECRET);
async function token(options: { issuer?: string; audience?: string; expired?: boolean; wrongKey?: boolean } = {}) {
  return new SignJWT({}).setProtectedHeader({alg:"HS256"}).setSubject("alice")
    .setIssuer(options.issuer ?? ${JSON.stringify(issuer)}).setAudience(options.audience ?? "chatjs-minimal")
    .setExpirationTime(options.expired ? 1 : Math.floor(Date.now()/1000)+60)
    .sign(options.wrongKey ? new TextEncoder().encode("wrong-fixture-key") : key);
}
async function identityCases(verify: typeof caller) {
  expect(await verify(new Request("https://fixture.invalid"))).toBeNull();
  expect(await verify(new Request("https://fixture.invalid", {headers:{"x-chatjs-owner":"alice"}}))).toBeNull();
  expect(await verify(new Request("https://fixture.invalid", {headers:{authorization:"Bearer " + await token()}}))).toBe("alice");
  for (const options of [{issuer:"wrong"},{audience:"wrong"},{expired:true},{wrongKey:true}]) {
    expect(await verify(new Request("https://fixture.invalid", {headers:{authorization:"Bearer " + await token(options)}}))).toBeNull();
  }
}
test("author identity contract: verified subject; missing, forged, expired and wrong-context credentials rejected", async () => {
  await identityCases(caller);
});
test("contract suite catches a type-correct but insecure implementation", async () => {
  const insecure: typeof caller = async () => "alice";
  await expect(identityCases(insecure)).rejects.toThrow();
});
test("mutation origin is enforced independently of a compatible identity return type", () => {
  expect(sameOrigin(new Request("https://fixture.invalid",{method:"POST",headers:{origin:"https://fixture.invalid"}}))).toBe(true);
  expect(sameOrigin(new Request("https://fixture.invalid",{method:"POST",headers:{origin:"https://other.invalid"}}))).toBe(false);
  expect(sameOrigin(new Request("https://fixture.invalid",{method:"POST"}))).toBe(false);
});
`;
const typeCases = `import type { caller } from "./lib/identity";
import type { Binding } from "./lib/application-client";
import type { LanguageModel } from "ai";
import type { ComponentType } from "react";
import type { ProjectData } from "./lib/projection";
const identity: typeof caller = async (_request) => "alice";
// @ts-expect-error identity cannot return an unverified claims object instead of a subject
const wrongIdentity: typeof caller = async () => ({ subject: "alice" });
// @ts-expect-error inferred tRPC output requires the bound session identity
const wrongBinding: Binding = { conversationId: "id" };
const layout: ComponentType<{ data: ProjectData }> = (_props) => null;
// @ts-expect-error a selected layout cannot require an unrelated data representation
const wrongLayout: typeof layout = (_props: {data:{unrelated:string}}) => null;
// @ts-expect-error a registry address is not an instantiated model
const wrongModel: LanguageModel = { registryAddress: "@vendor/model" };
void [identity, wrongIdentity, wrongBinding, wrongLayout, wrongModel];
`;
try {
  const cases = [
    { host:"node", provides:["verified-identity","application-binding","durable-execution"], requires:["verified-identity","application-binding","durable-execution"] },
    { host:"edge", provides:[], requires:[] },
    { host:"node", provides:["durable-execution"], requires:["application-binding"] },
    { host:"node", provides:["model"], requires:["files.write"] },
    { host:"node", provides:["model"], requires:[], conflictingSlots:["model"] },
  ];
  validateSelection(cases[0]);
  for (const selection of cases.slice(1)) assert.throws(() => validateSelection(selection));
  const listing = await run(["git", "ls-tree", "-r", "--name-only", commit, "--", prefix], source);
  const paths = listing.stdout.trim().split("\n");
  const results = [];
  for (const variant of ["m07-baseline", "text-only", "external-model-and-identity"] as const) {
    console.log(`Checking ${variant}`);
    const cwd = join(root, variant);
    await mkdir(cwd);
    for (const path of paths) {
      // Do not copy tests requiring DB, credential helpers, or development data.
      const relative = path.slice(prefix.length);
      if (!(relative.startsWith("app/") || relative.startsWith("lib/") || relative.startsWith("agent/") || ["package.json","bun.lock","tsconfig.json","next.config.ts"].includes(relative))) continue;
      const content = await run(["git", "show", `${commit}:${path}`], source);
      await write(cwd, relative, content.stdout);
    }
    if (variant === "text-only") {
      await rm(join(cwd,"agent/tools/confirm_note.ts"));
      await rm(join(cwd,"lib/note-contract.ts"));
      let projection = await readFile(join(cwd,"lib/projection.ts"),"utf8");
      projection = projection.replace('import { type ConfirmedNote, noteOutput } from "./note-contract";\n', "");
      projection = projection.replace('EveMessageData["messages"][number] & {\n\treadonly confirmedNotes: readonly ConfirmedNote[];\n}', 'EveMessageData["messages"][number]');
      const start = projection.indexOf("\t\tconst messages = projected.messages.map");
      const end = projection.indexOf("\t\tconst pending =", start);
      assert(start >= 0 && end > start);
      projection = projection.slice(0,start) + "\t\tconst messages = projected.messages;\n" + projection.slice(end);
      await write(cwd,"lib/projection.ts",projection);
      let ui = await readFile(join(cwd,"app/chat.tsx"),"utf8");
      const uiStart = ui.indexOf("\t\t\t\t\t\t{message.confirmedNotes.map");
      const uiEnd = ui.indexOf("\t\t\t\t\t</article>",uiStart);
      assert(uiStart >= 0 && uiEnd > uiStart);
      ui = ui.slice(0,uiStart) + ui.slice(uiEnd);
      ui = ui.replace("Ask a question, or ask me to confirm a note.","Ask a question.");
      await write(cwd,"app/chat.tsx",ui);
      await write(cwd,"agent/instructions.md","You are a concise assistant. Answer the user directly.\n");
      assert(!ui.includes("confirmedNotes"));
      assert(!projection.includes("note-contract"));
    }
    if (variant === "external-model-and-identity") {
      // Represents installed external source implementing existing SDK/identity seams.
      await replace(cwd,"lib/identity.ts",'issuer: "chatjs-host"','issuer: "acme-host"');
      await write(cwd,"lib/external-model.ts",`import { createOpenAICompatible } from "@ai-sdk/openai-compatible";\nimport type { LanguageModel } from "ai";\nexport const model = createOpenAICompatible({name:"fixture-external",baseURL:"https://model.invalid/v1"})("vendor/example") satisfies LanguageModel;\n`);
      await replace(cwd,"agent/agent.ts",'import { openai } from "@ai-sdk/openai";', 'import { model } from "../lib/external-model";');
      await replace(cwd,"agent/agent.ts",'model: openai("gpt-5-mini")', 'model');
      const pkg = JSON.parse(await readFile(join(cwd,"package.json"),"utf8"));
      delete pkg.dependencies["@ai-sdk/openai"];
      pkg.dependencies["@ai-sdk/openai-compatible"] = "3.0.44";
      await write(cwd,"package.json",JSON.stringify(pkg,null,2));
    }
    await run(["bun","install",...(variant === "external-model-and-identity" ? [] : ["--frozen-lockfile"])],cwd);
    await write(cwd,"compatibility.types.ts",typeCases);
    await write(cwd,"author.test.ts",contractTest(variant === "external-model-and-identity" ? "acme-host" : "chatjs-host"));
    if (variant !== "text-only") {
      await write(cwd,"renderer.types.ts",`import type { ConfirmedNote } from "./lib/note-contract";\nconst render = (value: ConfirmedNote) => value.note;\n// @ts-expect-error renderer must consume the inferred note output\nconst wrong: typeof render = (value: { url: string }) => value.url;\nvoid wrong;\n`);
      await write(cwd,"renderer.test.ts",`import {test,expect} from "bun:test";\nimport {noteOutput} from "./lib/note-contract";\ntest("serialized tool output is validated before rendering",()=>{\nexpect(noteOutput.safeParse(JSON.parse(JSON.stringify({note:"hello",confirmed:true})))).toMatchObject({success:true});\nexpect(noteOutput.safeParse({note:42,confirmed:true}).success).toBe(false);\nexpect(noteOutput.safeParse({note:"hello",confirmed:false}).success).toBe(false);\n});\n`);
    }
    await run(["bun","run","test:types"],cwd);
    const tests = await run(["bun","test","author.test.ts",...(variant === "text-only" ? [] : ["renderer.test.ts"])],cwd);
    // Prove the compiler is exercising this fixture: one unsuppressed bad assignment must fail.
    await write(cwd,"invalid.types.ts",'import type { Binding } from "./lib/application-client";\nconst invalid: Binding = { conversationId: "missing-session" };\n');
    const rejected = await run(["bun","node_modules/typescript/bin/tsc","--noEmit"],cwd,false);
    assert.notEqual(rejected.code,0);
    assert(rejected.stdout.includes("invalid.types.ts") && rejected.stdout.includes("sessionId"));
    await rm(join(cwd,"invalid.types.ts"));
    const pkg = JSON.parse(await readFile(join(cwd,"package.json"),"utf8"));
    results.push({variant,typecheck:"pass",conformance:"pass",tests:tests.stderr.trim(),unsuppressedInvalidBinding:"rejected",runtimeDependencies:pkg.dependencies,lockSHA256:new Bun.CryptoHasher("sha256").update(await readFile(join(cwd,"bun.lock"))).digest("hex")});
  }
  const evidence = {sourceCommit:commit,bun:Bun.version,scope:"Actual generated M07 source typechecks and local author conformance; no provider, DB, browser, or deployment execution",semanticNegativeCases:4,results};
  await writeFile(join(import.meta.dir,"evidence.json"),JSON.stringify(evidence,null,2)+"\n");
  console.log(JSON.stringify(evidence,null,2));
} finally { await rm(root,{recursive:true,force:true}); }
