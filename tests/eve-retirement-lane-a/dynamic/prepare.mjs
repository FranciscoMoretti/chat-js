import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const mode = process.argv[2] ?? "unchanged";
assert.ok(["unchanged", "response-adapted", "native-candidate"].includes(mode));
const repository = path.resolve(import.meta.dirname, "../../..");
const app = path.join(repository, "apps/chat");
const fixture = await mkdtemp(path.join(tmpdir(), "lane-a-installed-"));
await cp(path.join(import.meta.dirname, "template"), fixture, {
  recursive: true,
});
const sources = [
  "agent/tools/installed.ts",
  "tools/chatjs/tools.ts",
  "tools/chatjs/custom-tools.ts",
  "tools/chatjs/installed-features.ts",
  "tools/chatjs/delete-document/tool.ts",
  "tools/chatjs/delete-document/availability.ts",
  "tools/chatjs/delete-document/schemas.ts",
  "lib/eve/tool-types.ts",
  "lib/eve/turn-tools.ts",
  "lib/eve/selected-tools.ts",
  "lib/eve/document-contracts.ts",
  "lib/eve/image-context.ts",
  "lib/eve/tool-image-context.ts",
  "lib/file-url.ts",
  "lib/is-non-empty-string.ts",
  "lib/eve/conversation-scope.ts",
  "lib/eve/session-mapping-error.ts",
];
const provenance = [];
/* oxlint-disable eslint/no-await-in-loop -- Source validation and provenance order are deterministic; each copy follows its validated source. */
for (const relative of sources) {
  const original = await readFile(path.join(app, relative), "utf-8");
  let content = original;
  if (relative.endsWith("delete-document/tool.ts") && mode !== "unchanged") {
    const expected =
      "response: ({ responder, session }: DeleteDocumentResponseContext) =>";
    assert.equal(content.split(expected).length, 2);
    content = content.replace(
      expected,
      "response: ({ response: { principal: responder }, session }: DeleteDocumentResponseContext) =>"
    );
  }
  if (
    relative.endsWith("delete-document/tool.ts") &&
    mode === "native-candidate"
  ) {
    const expected = `  const { approval } = context;\n  if (!approval || approval.responder.principalId !== scope.ownerId) {\n    throw new Error("Document deletion requires the owner's approval.");\n  }\n`;
    assert.equal(content.split(expected).length, 2);
    content = content.replace(expected, "");
  }
  const destination = path.join(fixture, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
  provenance.push({
    modified: content !== original,
    path: relative,
    sha256: createHash("sha256").update(original).digest("hex"),
  });
}
/* oxlint-enable eslint/no-await-in-loop */
// Unselected implementations must not import live providers or app credentials.
const unrelated = {
  "code-documents/tool.ts": ["createCodeDocument", "editCodeDocument"],
  "get-weather/tool.ts": ["getWeather"],
  "read-document/tool.ts": ["readDocument"],
  "saved-code-execution/tool.ts": ["runCodeDocument"],
  "sheet-documents/tool.ts": ["createSheetDocument", "editSheetDocument"],
  "text-documents/tool.ts": ["createTextDocument", "editTextDocument"],
  "word-count/tool.ts": ["wordCount"],
};
/* oxlint-disable eslint/no-await-in-loop -- Source validation and provenance order are deterministic; each copy follows its validated source. */
for (const [relative, names] of Object.entries(unrelated)) {
  const file = path.join(fixture, "tools/chatjs", relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `import { unavailable } from "../../../proof/unavailable";\n${names.map((name) => `export const ${name} = unavailable;`).join("\n")}\n`
  );
}
/* oxlint-enable eslint/no-await-in-loop */
await writeFile(
  path.join(fixture, "tools/chatjs/providers.ts"),
  `import { unavailable } from "../../proof/unavailable";\nexport const providers = Object.fromEntries(["codeExecution","generateImage","generateVideo","retrieveUrl","webSearch"].map(name => [name, unavailable]));\n`
);
await cp(
  path.join(repository, "tests/eve-retirement-lane-a/fixture/agent/channels"),
  path.join(fixture, "agent/channels"),
  { recursive: true }
);
await cp(
  path.join(
    repository,
    "tests/eve-retirement-lane-a/fixture/evals/evals.config.ts"
  ),
  path.join(fixture, "evals/evals.config.ts")
);
await writeFile(
  path.join(fixture, "proof/mode.ts"),
  `export const mode = ${JSON.stringify(mode)};\n`
);
await writeFile(
  path.join(fixture, "source-provenance.json"),
  JSON.stringify({ mode, sources: provenance }, null, 2)
);
await writeFile(
  path.join(fixture, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } },
  })
);
process.stdout.write(`${fixture}\n`);
