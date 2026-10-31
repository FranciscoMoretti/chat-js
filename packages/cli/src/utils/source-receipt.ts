import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { optionalFile } from "./installation-files";
import { preflight } from "./preflight";

type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

const RECEIPT_INDENTATION_SPACES = 2;
const SOURCE_READ_CONCURRENCY = 4;
const receiptFile = "chatjs/installed-source.json";
const sourceBaselineFile = "chatjs/installed-source-content.json";
const receiptSchema = z.record(z.string(), z.string());
const hash = (content: ReadonlyNative<Buffer>): string =>
  createHash("sha256").update(content).digest("hex");

const readReceipt = async (
  cwd: string
): Promise<z.infer<typeof receiptSchema>> => {
  await preflight(cwd, [receiptFile]);
  const source = await optionalFile(path.join(cwd, receiptFile));
  if (source) {
    return receiptSchema.parse(JSON.parse(source.toString()));
  }
  return {};
};
const readSourceBaselines = async (
  cwd: string
): Promise<Record<string, string>> => {
  await preflight(cwd, [sourceBaselineFile]);
  const source = await optionalFile(path.join(cwd, sourceBaselineFile));
  return source ? receiptSchema.parse(JSON.parse(source.toString())) : {};
};
const sourceHashes = async (
  cwd: string,
  targets: readonly string[],
  validate?: (
    target: string,
    digest: string | null,
    content: Buffer | null
  ) => void
): Promise<(readonly [string, string | null])[]> => {
  const hashes: (readonly [string, string | null])[] = [];
  for (
    let offset = 0;
    offset < targets.length;
    offset += SOURCE_READ_CONCURRENCY
  ) {
    // oxlint-disable-next-line no-await-in-loop -- Bound live file buffers to four; drain each batch before reporting its first source-order read error.
    const batch = await Promise.allSettled(
      targets
        .slice(offset, offset + SOURCE_READ_CONCURRENCY)
        .map(async (target) => {
          const content = await optionalFile(path.join(cwd, target));
          const digest = content ? hash(content) : null;
          validate?.(target, digest, content ?? null);
          return [target, digest] as const;
        })
    );
    for (const result of batch) {
      if (result.status === "rejected") {
        throw result.reason;
      }
      hashes.push(result.value);
    }
  }
  return hashes;
};

/**
 * Capture only source we actually installed. Never bless a skipped user file.
 * @param {string} cwd Project containing the receipt and installed source files.
 * @param {readonly string[]} targets Ordered installed paths to hash without modifying the caller list.
 */
const recordInstalledSource = async (
  cwd: string,
  targets: readonly string[]
): Promise<void> => {
  const receipt = await readReceipt(cwd);
  const baselines = await readSourceBaselines(cwd);
  await preflight(cwd, targets);
  const hashes = await sourceHashes(
    cwd,
    targets,
    (target, _digest, content) => {
      if (content !== null) {
        baselines[target] = content.toString("base64");
      }
    }
  );
  for (const [target, digest] of hashes) {
    if (digest !== null) {
      receipt[target] = digest;
    }
  }
  await mkdir(path.join(cwd, "chatjs"), { recursive: true });
  // Readers verify these bytes against the receipt, so interrupted writes fail closed.
  await writeFile(
    path.join(cwd, sourceBaselineFile),
    `${JSON.stringify(
      Object.fromEntries(
        Object.keys(baselines)
          .toSorted()
          .map((file) => [file, baselines[file]])
      ),
      null,
      RECEIPT_INDENTATION_SPACES
    )}\n`
  );
  await writeFile(
    path.join(cwd, receiptFile),
    `${JSON.stringify(receipt, null, RECEIPT_INDENTATION_SPACES)}\n`
  );
};

export {
  hash,
  readReceipt,
  receiptFile,
  sourceHashes,
  recordInstalledSource,
  readSourceBaselines,
  sourceBaselineFile,
};
