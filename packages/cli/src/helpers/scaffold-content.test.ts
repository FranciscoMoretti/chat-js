import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
} from "./scaffold-content";

test.each([
  {
    excluded: ["evals/my-eval.eval.ts"],
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
