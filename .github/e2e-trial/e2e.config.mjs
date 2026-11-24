import { web } from "@e2e-dev/web";

export default {
  assertionTimeout: 10_000,
  retries: 0,
  targets: [
    {
      app: { url: "http://localhost:3000" },
      engine: web({ browser: "chromium" }),
      name: "chromium",
    },
  ],
  timeout: 60_000,
  trace: "off",
  workers: 1,
};
