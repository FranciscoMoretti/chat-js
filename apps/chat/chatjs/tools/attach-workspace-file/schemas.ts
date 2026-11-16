import { z } from "zod";
import { isFileStorageKey } from "@/lib/file-url";

export const maximumWorkspaceFileBytes = 32 * 1024 * 1024;

export const attachWorkspaceFileInput = z.object({
  path: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^[^\p{Cc}]+$/u)
    .describe(
      "File in the current EVE sandbox workspace, e.g. /workspace/report.xlsx."
    ),
  name: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[^/\\\p{Cc}]+$/u)
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
