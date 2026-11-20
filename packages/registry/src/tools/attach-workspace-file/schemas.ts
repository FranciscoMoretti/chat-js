import { z } from "zod";
import { isFileStorageKey } from "@/lib/file-url";

export const maximumWorkspaceFileBytes = 32 * 1024 * 1024;

// Keep Unicode character validation at runtime so model providers do not have
// to compile JavaScript Unicode property escapes from the tool's JSON Schema.
const controlCharacter = /\p{Cc}/u;
const invalidFilenameCharacter = /[/\\\p{Cc}]/u;

export const attachWorkspaceFileInput = z.object({
  path: z
    .string()
    .min(1)
    .max(4096)
    .refine(
      (path) => !controlCharacter.test(path),
      "Path contains a control character."
    )
    .describe(
      "File in the current EVE sandbox workspace, e.g. /workspace/report.xlsx."
    ),
  name: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .refine(
      (name) => !invalidFilenameCharacter.test(name),
      "Filename contains a separator or control character."
    )
    .optional()
    .describe("Optional download filename, including its extension."),
});

export const attachWorkspaceFileResult = z.object({
  fileId: z.string().min(1),
  name: z.string().min(1),
  mediaType: z.string().min(1),
  size: z.number().int().nonnegative().max(maximumWorkspaceFileBytes),
  url: z.string().min(1),
});

export const importFileInput = z.object({
  fileId: z
    .string()
    .refine(isFileStorageKey, "Use a fileId from this conversation.")
    .describe(
      "Exact fileId returned by attach_workspace_file, or the storage key in a file attachment URL in this conversation. Never guess a file ID."
    ),
  name: attachWorkspaceFileInput.shape.name
    .unwrap()
    .describe(
      "Filename from the referenced artifact, including its extension."
    ),
});

export const importFileResult = attachWorkspaceFileResult
  .omit({ url: true })
  .extend({
    path: z.string().min(1),
  });
