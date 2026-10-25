import { open, unlink } from "node:fs/promises";

/** An exclusive checkout-local writer lease. Never guess whether an old PID is safe to steal. */
export const withMirrorLock = async <Result>(
  file: string,
  operation: () => Promise<Result>
): Promise<Result> => {
  const handle = await open(file, "wx").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(
        `Another registry mirror owns ${file}. Wait for it to finish and retry. If a process crashed, verify it has stopped before removing this lock.`
      );
    }
    throw error;
  });
  try {
    await handle.writeFile(`${process.pid}\n`);
    return await operation();
  } finally {
    await handle.close();
    await unlink(file);
  }
};
