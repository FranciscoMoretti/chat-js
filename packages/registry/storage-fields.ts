import { z } from "zod";
import type { FtpAdapterOptions } from "files-sdk/ftp";
import type { NetlifyBlobsAdapterOptions } from "files-sdk/netlify-blobs";
import type { S3AdapterOptions } from "files-sdk/s3";
import type { SftpAdapterOptions } from "files-sdk/sftp";

export const storageFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "port", "json"]),
  optional: z.boolean().optional(),
  legacyKey: z.string().min(1).optional(),
});
export type StorageField = z.infer<typeof storageFieldSchema>;

const portField = {
  key: "port",
  label: "port",
  type: "port",
} as const satisfies StorageField & {
  key: keyof FtpAdapterOptions & keyof SftpAdapterOptions;
};

const textField = (key: string): StorageField => ({
  key,
  label: key,
  type: "text",
});

// The Files SDK exposes human-readable configuration hints. These adapters
// have an option name, type or optional setting the hints alone cannot express.
export const builtinStorageFields = (
  id: string,
  hints: readonly string[]
): StorageField[] => {
  if (id === "memory") {
    return [];
  }
  const fields = hints.map((hint) => {
    if (id === "netlify-blobs" && hint === "store name") {
      return {
        key: "name" satisfies keyof NetlifyBlobsAdapterOptions,
        label: hint,
        legacyKey: hint,
        type: "text",
      } as const;
    }
    if ((id === "ftp" || id === "sftp") && hint === portField.key) {
      return portField;
    }
    return textField(hint);
  });
  if (id === "s3" && !fields.some(({ key }) => key === "region")) {
    fields.push({
      ...textField("region" satisfies keyof S3AdapterOptions),
      optional: true,
    });
  }
  return fields;
};

interface StorageFieldSource {
  readonly id: string;
  readonly configKeys: readonly string[];
  readonly configFields?: readonly StorageField[];
}

export const storageFields = (
  definition: StorageFieldSource,
  source: string
): readonly StorageField[] =>
  definition.configFields ??
  (source === `@chatjs/${definition.id}-storage`
    ? builtinStorageFields(definition.id, definition.configKeys)
    : definition.configKeys.map((key) => ({
        key,
        label: key,
        type: "json" as const,
      })));

export const storageFieldValue = (
  field: Readonly<StorageField>,
  input: string
) => (field.type === "port" && /^\d+$/u.test(input) ? Number(input) : input);

// Older presets stored form labels and text input values directly.
export const normalizeStorageOptions = (
  fields: readonly StorageField[],
  input: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  const options = new Map(Object.entries(input));
  for (const field of fields) {
    if (
      field.legacyKey !== undefined &&
      field.legacyKey !== field.key &&
      options.has(field.legacyKey)
    ) {
      if (!options.has(field.key)) {
        options.set(field.key, options.get(field.legacyKey));
      }
      options.delete(field.legacyKey);
    }
    const value = options.get(field.key);
    if (field.optional === true && value === "") {
      options.delete(field.key);
    } else if (typeof value === "string") {
      options.set(field.key, storageFieldValue(field, value));
    }
  }
  return Object.fromEntries(options);
};

export const storageFieldIssue = (
  field: Readonly<StorageField>,
  value: unknown
): string | undefined => {
  if (value === undefined || value === "") {
    return field.optional === true
      ? undefined
      : `Missing public configuration: ${field.label}.`;
  }
  if (field.type === "port") {
    return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 65_535
      ? undefined
      : `Enter a port between 1 and 65535 for ${field.label}.`;
  }
  // A legacy external descriptor declares only keys. Its adapter may take
  // objects or numbers in --storage-config; preserve those JSON values.
  if (field.type === "json" && value !== null && typeof value !== "string") {
    return undefined;
  }
  return typeof value === "string" && value.trim().length > 0
    ? undefined
    : `Enter a value for ${field.label}.`;
};

export const storageOptionIssues = (
  fields: readonly StorageField[],
  options: Readonly<Record<string, unknown>>
): string[] =>
  fields.flatMap((field) => {
    const issue = storageFieldIssue(field, options[field.key]);
    return issue === undefined ? [] : [issue];
  });
