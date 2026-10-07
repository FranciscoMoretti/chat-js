import Prism from "prismjs";

// Prism language modules expect the global supplied by the application's bundler.
Object.assign(globalThis, { Prism });
// oxlint-disable-next-line node/no-top-level-await -- This browser fixture loads the component after initializing the Prism global expected by its language modules.
await import("./eve-document-auto-open.fixture");
