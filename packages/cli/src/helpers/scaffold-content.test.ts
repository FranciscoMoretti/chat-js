import { expect, test } from "bun:test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
} from "./scaffold-content";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; each case awaits fixture creation, copying, assertions, and cleanup. */
/* oxlint-enable sort-imports */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
test.each([
  {
    excluded: [
      "evals/my-eval.eval.ts",
      "tests/visual/eve-tool-results.browser.tsx",
      "tests/visual/sandbox.css",
      "lib/db/eve-subagents.test.ts",
      "lib/db/mcp-oauth-lock.test.ts",
      "app/api/mcp/oauth/callback/route.test.ts",
      "lib/eve/research-availability.test.ts",
      "tests/native-research-runtime.ts",
      "scripts/db-branch-create.sh",
      "scripts/db-branch-delete.sh",
      "scripts/db-branch-use.sh",
      "scripts/with-db.sh",
    ],
    filter: shouldCopyChatAppFile,
    name: "ChatJS",
  },
  {
    excluded: ["release/app.zip", "branding.json"],
    filter: shouldCopyElectronFile,
    name: "Electron",
  },
])(
  "copying $name excludes private environments and generated artifacts at any depth",
  async ({ filter, excluded }) => {
    const root = await mkdtemp(path.join(tmpdir(), "scaffold-content-"));
    const source = path.join(root, "source");
    const destination = path.join(root, "app");
    const privateFiles = [
      ".env",
      ".env.local",
      ".env.production.local",
      ".env.worktree.local",
      "nested/.env.test",
      "tsconfig.tsbuildinfo",
      "nested/custom.tsbuildinfo",
      ".devtools/session.json",
      ".next/cache.json",
      ".vercel/project.json",
      "guest/.vercel/output/config.json",
      ...excluded,
    ];
    const retainedFiles = [
      ".env.example",
      "nested/.env.example",
      "app/page.tsx",
      "lib/eve/message-delivery.test.ts",
    ];
    try {
      await Promise.all(
        [...privateFiles, ...retainedFiles].map(async (file) => {
          const target = path.join(source, file);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, "synthetic fixture");
        })
      );
      await cp(source, destination, {
        filter: (file) => filter(path.relative(source, file)),
        recursive: true,
      });
      const privateCopies = await Promise.all(
        privateFiles.map((file) =>
          Bun.file(path.join(destination, file)).exists()
        )
      );
      expect(privateCopies).toEqual(privateFiles.map(() => false));
      const retainedCopies = await Promise.all(
        retainedFiles.map((file) =>
          readFile(path.join(destination, file), "utf-8")
        )
      );
      expect(retainedCopies).toEqual(
        retainedFiles.map(() => "synthetic fixture")
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
