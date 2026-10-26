import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { expect, test } from "bun:test";
import {
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
} from "./scaffold-content";
import path from "node:path";
import { tmpdir } from "node:os";

test.each([
  {
    excluded: [
      "evals/my-eval.eval.ts",
      "components/ui/control-defaults-visual-fixture.tsx",
      "tests/visual/eve-tool-results.browser.tsx",
      "tests/visual/sandbox.css",
      "tests/layout-primitives.visual.css",
      "tests/visual/pages/chat.browser.tsx",
      "lib/db/eve-subagents.test.ts",
      "lib/db/eve-guest-rate.test.ts",
      "lib/db/eve-query-lookups.test.ts",
      "lib/db/mcp-oauth-lock.test.ts",
      "app/api/mcp/oauth/callback/route.test.ts",
      "lib/eve/research-availability.test.ts",
      "lib/eve/tool-usage.test.ts",
      "tests/native-research-runtime.ts",
      "tests/fixtures/eve-oauth-mcp-server.ts",
      "tests/fixtures/eve-oauth-mcp-server.test.ts",
      "scripts/db-branch-create.sh",
      "scripts/db-branch-delete.sh",
      "scripts/db-branch-use.sh",
      "scripts/with-db.sh",
    ],
    filter: shouldCopyChatAppFile,
    name: "ChatJS",
  },
  {
    excluded: [
      "release/app.zip",
      "out/ChatJS.app/Contents/Resources/app.asar",
      "branding.json",
    ],
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
      "uiverify-archive/snapshots/capture.json",
      "nested/uiverify-archive/resources/asset.png",
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
        privateFiles.map(
          async (file) => await Bun.file(path.join(destination, file)).exists()
        )
      );
      expect(privateCopies).toEqual(privateFiles.map(() => false));
      const retainedCopies = await Promise.all(
        retainedFiles.map(
          async (file) => await readFile(path.join(destination, file), "utf-8")
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
