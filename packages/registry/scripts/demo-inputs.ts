// ChatJS generator inputs only. Installed output and the ownership manifest
// cannot invalidate their producer. Selection stays in installation.ts.
export const demoInputs = [
  "packages/registry/*.{ts,json}",
  "packages/registry/scripts/**/*.ts",
  "packages/registry/src/**",
  "packages/cli/src/**",
  "packages/cli/package.json",
  "packages/gateways/src/**",
  "packages/gateways/package.json",
  "packages/sandboxes/src/**",
  "packages/sandboxes/package.json",
  "apps/chat/{components.json,oxfmt.config.ts}",
  "{package.json,bun.lock,oxfmt.config.ts}",
  "patches/**",
  "!packages/registry/mirror-manifest.json",
  "!packages/registry/registry.json",
];
