import { describe, expect, it } from "bun:test";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RegistryToolItemFile } from "../registry/schema";
import { writeToolFiles } from "./write-files";

function registryFile(
  target: string,
  content: string,
  type: RegistryToolItemFile["type"] = "tool"
): RegistryToolItemFile {
  return { content, path: target, target, type };
}

describe("writeToolFiles", () => {
  it("treats identical existing files as already installed", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chatjs-write-files-"));
    const uiDir = join(cwd, "components/ui");
    const content = "export const modal = {};";

    try {
      await mkdir(uiDir, { recursive: true });
      await writeFile(join(uiDir, "image-modal.tsx"), content);

      const result = await writeToolFiles(
        [registryFile("image-modal.tsx", content, "ui")],
        {
          dryRun: true,
          toolsAlias: "@/tools/chatjs",
          toolsDir: join(cwd, "tools"),
          uiAlias: "@/components/ui",
          uiDir,
        }
      );

      expect(result).toEqual({ existing: [], written: [] });
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });

  it("reports non-file destinations as conflicts", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chatjs-write-files-"));
    const toolsDir = join(cwd, "tools");

    try {
      await mkdir(join(toolsDir, "example", "tool.ts"), { recursive: true });

      const result = await writeToolFiles(
        [registryFile("example/tool.ts", "export const tool = {};")],
        {
          dryRun: true,
          toolsAlias: "@/tools/chatjs",
          toolsDir,
          uiAlias: "@/components/ui",
          uiDir: join(cwd, "components/ui"),
        }
      );

      expect(result).toEqual({
        existing: [join(toolsDir, "example", "tool.ts")],
        written: [],
      });
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });

  it("reports conflicts without partially writing during preflight", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chatjs-write-files-"));
    const toolsDir = join(cwd, "tools");
    const uiDir = join(cwd, "components/ui");

    try {
      await mkdir(uiDir, { recursive: true });
      await writeFile(join(uiDir, "image-modal.tsx"), "existing");

      const result = await writeToolFiles(
        [
          registryFile("example/tool.ts", "export const tool = {};"),
          registryFile("image-modal.tsx", "export const modal = {};", "ui"),
        ],
        {
          dryRun: true,
          toolsAlias: "@/tools/chatjs",
          toolsDir,
          uiAlias: "@/components/ui",
          uiDir,
        }
      );

      expect(result.existing).toEqual([join(uiDir, "image-modal.tsx")]);
      await expect(access(join(toolsDir, "example/tool.ts"))).rejects.toThrow();
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });

  it("rejects conflicting files that resolve to the same destination", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chatjs-write-files-"));

    try {
      await expect(
        writeToolFiles(
          [
            registryFile("image-modal.tsx", "export const first = {};", "ui"),
            registryFile("image-modal.tsx", "export const second = {};", "ui"),
          ],
          {
            dryRun: true,
            toolsAlias: "@/tools/chatjs",
            toolsDir: join(cwd, "tools"),
            uiAlias: "@/components/ui",
            uiDir: join(cwd, "components/ui"),
          }
        )
      ).rejects.toThrow("conflicting destination");
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });

  it("rejects dangling symlink destinations during preflight", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chatjs-write-files-"));
    const uiDir = join(cwd, "components/ui");

    try {
      await mkdir(uiDir, { recursive: true });
      await symlink(
        join(cwd, "outside/missing.tsx"),
        join(uiDir, "image-modal.tsx")
      );

      await expect(
        writeToolFiles(
          [registryFile("image-modal.tsx", "export const modal = {};", "ui")],
          {
            dryRun: true,
            toolsAlias: "@/tools/chatjs",
            toolsDir: join(cwd, "tools"),
            uiAlias: "@/components/ui",
            uiDir,
          }
        )
      ).rejects.toThrow("Refusing to overwrite symlinked file");
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
