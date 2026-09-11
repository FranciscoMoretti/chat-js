import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";

const manifestSchema = z.strictObject({
  version: z.literal(1),
  sessionKey: z.string().min(1),
  snapshotName: z.string().regex(/^eve-sbx-fork-[a-f0-9]{32}$/),
  optionsHash: z.string().min(1),
});
const metadataSchema = z.object({
  version: z.literal(2),
  optionsHash: z.string().min(1),
});

/** Internal local-provider stage. Caller must retire the entire owning family first. */
export async function purgeLocalEveForkSnapshots(input: {
  sessionDirectory: string;
  sessionKey: string;
}) {
  if (basename(input.sessionDirectory) !== input.sessionKey) {
    throw new Error("Sandbox directory does not match its session key.");
  }
  const metadata = metadataSchema.parse(
    JSON.parse(
      await readFile(join(input.sessionDirectory, "metadata.json"), "utf8")
    )
  );
  const directory = join(input.sessionDirectory, "fork-checkpoints");
  const entries = await readdir(directory).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  const snapshots: string[] = [];
  for (const entry of entries.sort()) {
    // Atomic-write leftovers precede provider creation and are not published records.
    if (entry.endsWith(".tmp")) {
      continue;
    }
    const record = manifestSchema.parse(
      JSON.parse(await readFile(join(directory, entry), "utf8"))
    );
    if (
      entry !== `${record.snapshotName}.json` ||
      record.sessionKey !== input.sessionKey ||
      record.optionsHash !== metadata.optionsHash
    ) {
      throw new Error("Fork snapshot ownership is inconsistent.");
    }
    snapshots.push(record.snapshotName);
  }
  if (!snapshots.length) {
    return snapshots;
  }
  // Validate the full set before any provider side effect. Never restore a VM,
  // list/prune global snapshots, or force removal of a referenced snapshot.
  const { Snapshot } = await import("microsandbox");
  for (const snapshot of snapshots) {
    try {
      await Snapshot.remove(snapshot, { force: false });
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          error.message.startsWith("[SnapshotNotFound] snapshot not found:")
        )
      ) {
        throw error;
      }
    }
  }
  // Keep identity records: an interrupted caller can repeat removal safely.
  return snapshots;
}
