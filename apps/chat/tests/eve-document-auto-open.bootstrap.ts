import Prism from "prismjs";

// Prism language modules expect the global supplied by the application's bundler.
Object.assign(globalThis, { Prism });
/* oxlint-disable node/no-top-level-await --
 * node/no-top-level-await (#539): await import("./eve-document-auto-open.fixture"); runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
await import("./eve-document-auto-open.fixture");
/* oxlint-enable node/no-top-level-await */
