import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { generateDemo } from "./demo-generator";

const requestSchema = z.object({
  changes: z.array(z.string()).optional(),
  previous: z.record(z.string(), z.string()).optional(),
});
const [request, result] = process.argv.slice(2);
if (!request || !result) {
  throw new Error("Expected demo worker request and result paths");
}
let exitCode = 0;
try {
  const started = performance.now();
  const options = requestSchema.parse(
    JSON.parse(await readFile(request, "utf-8"))
  );
  const generated = await generateDemo(options);
  await writeFile(
    result,
    JSON.stringify({
      files: Object.fromEntries(generated.files),
      ownedPaths: generated.ownedPaths,
    })
  );
  console.info(
    `[registry-mirror] Generated in ${Math.round(performance.now() - started)}ms`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
}
// End only after generation cleanup has settled. Installer libraries
// can retain handles after a failed full generation; they must not block recovery.
process.exit(exitCode);
