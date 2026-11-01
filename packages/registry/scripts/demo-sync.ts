import { createDemoMirror } from "./demo-mirror";

const interrupted = (): void => {
  process.exitCode = 130;
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check")) {
    throw new Error("Usage: bun demo:sync [--check]");
  }
  process.on("SIGINT", interrupted);
  process.on("SIGTERM", interrupted);
  try {
    await createDemoMirror().run({ check: args.includes("--check") });
  } finally {
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
  }
}
