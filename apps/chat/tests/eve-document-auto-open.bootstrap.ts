import Prism from "prismjs";

// Prism language modules expect the global supplied by the application's bundler.
Object.assign(globalThis, { Prism });
await import("./eve-document-auto-open.fixture");
