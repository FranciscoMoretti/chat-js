/* eslint-disable no-bitwise -- This versioned wire format deliberately packs BigInt bit fields. */
import { installationSelectionSchema } from "./installation";
import type { InstallationSelection } from "./installation";

// Wire format v1 ("a"). These IDs are permanent: append only, never reorder or
// reuse a removed ID. Reserve its slot instead. Field offsets/widths are fixed;
// changing them requires a new version and retaining this decoder.
// The catalog is deliberately not derived from registry order.
const V1 = {
  gateway: {
    offset: 0n,
    bits: 4n,
    values: ["vercel", "openai", "openai-compatible", "openrouter", "litellm"],
  },
  storage: {
    offset: 4n,
    bits: 8n,
    values: [
      "akamai",
      "alibaba",
      "appwrite",
      "archil",
      "azure",
      "backblaze-b2",
      "bunny-storage",
      "cloudinary",
      "digitalocean-spaces",
      "dropbox",
      "exoscale",
      "filebase",
      "firebase-storage",
      "ftp",
      "gcs",
      "google-drive",
      "hetzner",
      "ibm-cos",
      "idrive-e2",
      "memory",
      "minio",
      "neon",
      "netlify-blobs",
      "onedrive",
      "oracle-cloud",
      "ovhcloud",
      "pocketbase",
      "r2",
      "s3",
      "scaleway",
      "sftp",
      "sharepoint",
      "storj",
      "supabase",
      "tencent",
      "tigris",
      "uploadthing",
      "vercel-blob",
      "vultr",
      "wasabi",
      "webdav",
      "yandex",
    ],
  },
  sandbox: { offset: 12n, bits: 4n, values: ["vercel", "daytona"] },
  plugins: {
    offset: 16n,
    bits: 32n,
    values: [
      "projects",
      "feedback",
      "followup-suggestions",
      "search",
      "desktop",
      "credits",
      "guest-chat",
      "model-preferences",
      "ai-titles",
      "sharing",
      "mcp",
      "attachment-uploads",
      "vercel-analytics",
      "vercel-speed-insights",
      "langfuse",
    ],
  },
  tools: {
    offset: 48n,
    bits: 32n,
    values: [
      "generate-video",
      "generate-image",
      "word-count",
      "get-weather",
      "retrieve-url",
      "delete-document",
      "read-document",
      "text-documents",
      "code-documents",
      "sheet-documents",
      "saved-code-execution",
      "deep-research",
      "tavily-search",
      "firecrawl-search",
      "code-execution",
    ],
  },
} as const;
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const RADIX = 62n;
const TOTAL_BITS = 80n;
const MAX_CODE_LENGTH = 15;
interface Field {
  readonly offset: bigint;
  readonly bits: bigint;
  readonly values: readonly string[];
}

const position = (field: Field, id: string): number => {
  const index = field.values.indexOf(id);
  if (index === -1) {
    throw new Error(
      `App presets cannot encode ${id}. Use explicit CLI options for custom registry items.`
    );
  }
  return index;
};
const encodeChoice = (field: Field, id?: string): bigint => {
  const value = id === undefined ? 0n : BigInt(position(field, id) + 1);
  if (value >= 1n << field.bits) {
    throw new Error(
      "App preset field capacity exceeded; a new format version is required."
    );
  }
  return value << field.offset;
};
const encodeFlags = (field: Field, ids: readonly string[]): bigint => {
  let value = 0n;
  for (const id of ids) {
    const index = BigInt(position(field, id));
    if (index >= field.bits) {
      throw new Error(
        "App preset field capacity exceeded; a new format version is required."
      );
    }
    value |= 1n << index;
  }
  return value << field.offset;
};

/** Encodes built-in choices only. Provider-specific values travel separately. */
export const encodeAppPreset = (input: InstallationSelection): string => {
  const selection = installationSelectionSchema.parse(input);
  if (Object.keys(selection.storage?.options ?? {}).length > 0) {
    throw new Error(
      "Keep custom storage values in --storage-config, outside the App preset."
    );
  }
  let value =
    encodeChoice(V1.gateway, selection.gateway) |
    encodeChoice(V1.storage, selection.storage?.source) |
    encodeChoice(V1.sandbox, selection.sandbox) |
    encodeFlags(V1.plugins, selection.plugins) |
    encodeFlags(V1.tools, selection.tools);
  let encoded = "";
  do {
    encoded = ALPHABET[Number(value % RADIX)] + encoded;
    value /= RADIX;
  } while (value > 0n);
  return `a${encoded}`;
};

const fieldValue = (value: bigint, field: Field): bigint =>
  (value >> field.offset) & ((1n << field.bits) - 1n);
const decodeChoice = (value: bigint, field: Field): string | undefined => {
  const index = Number(fieldValue(value, field));
  if (index > field.values.length) {
    throw new Error(
      "This App preset uses an unsupported provider. Update ChatJS to open it."
    );
  }
  return index === 0 ? undefined : field.values[index - 1];
};
const decodeFlags = (value: bigint, field: Field): string[] => {
  const flags = fieldValue(value, field);
  if (flags >> BigInt(field.values.length)) {
    throw new Error(
      "This App preset uses unsupported features. Update ChatJS to open it."
    );
  }
  return field.values.filter(
    (_, index) => (flags & (1n << BigInt(index))) !== 0n
  );
};

/** Reject unknown versions and bits: never silently install a different app. */
export const decodeAppPreset = (code: string): InstallationSelection => {
  if (
    !/^a(?:0|[1-9A-Za-z][0-9A-Za-z]*)$/u.test(code) ||
    code.length > MAX_CODE_LENGTH
  ) {
    throw new Error(
      "Invalid or unsupported App preset. Expected a version-a code; update ChatJS if it was created by a newer version."
    );
  }
  let value = 0n;
  for (const character of code.slice(1)) {
    value = value * RADIX + BigInt(ALPHABET.indexOf(character));
  }
  if (value >= 1n << TOTAL_BITS) {
    throw new Error("App preset exceeds the version-a layout.");
  }
  const source = decodeChoice(value, V1.storage);
  const gateway = decodeChoice(value, V1.gateway);
  const sandbox = decodeChoice(value, V1.sandbox);
  return installationSelectionSchema.parse({
    plugins: decodeFlags(value, V1.plugins),
    tools: decodeFlags(value, V1.tools),
    ...(gateway === undefined ? {} : { gateway }),
    ...(sandbox === undefined ? {} : { sandbox }),
    ...(source === undefined ? {} : { storage: { source, options: {} } }),
  });
};

/** One input contract for Create links and CLI: a compact code or explicit JSON. */
export const readInstallationInput = (
  input: string,
  storageConfig?: string
): InstallationSelection => {
  const encoded = input.trim();
  const isJson = encoded.startsWith("{");
  const selection = isJson
    ? installationSelectionSchema.parse(JSON.parse(encoded))
    : decodeAppPreset(encoded);
  if (storageConfig !== undefined) {
    if (isJson) {
      throw new Error(
        "JSON installations already contain storage options; do not also pass --storage-config."
      );
    }
    if (!selection.storage) {
      throw new Error("--storage-config requires storage in the App preset.");
    }
    selection.storage.options = installationSelectionSchema.shape.storage
      .unwrap()
      .shape.options.parse(JSON.parse(storageConfig));
  }
  return selection;
};

/** Split the complete selection into its compact choices and explicit values. */
export const encodeInstallationInput = (
  input: InstallationSelection
): { code: string; storageConfig?: string } => {
  const selection = installationSelectionSchema.parse(input);
  const { storage } = selection;
  return {
    code: encodeAppPreset({
      ...selection,
      ...(storage ? { storage: { source: storage.source, options: {} } } : {}),
    }),
    ...(storage && Object.keys(storage.options).length > 0
      ? { storageConfig: JSON.stringify(storage.options) }
      : {}),
  };
};
