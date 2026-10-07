import { expect, test } from "vitest";

import { mcpFetch } from "./mcp-fetch";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   "http://127.0.0.1/",   "http://10.0.0.1/",   "http://169.254.169.254/latest/meta-data/'s awaited sequencing and rejected-Promise behavior. */
test.each([
  "http://127.0.0.1/",
  "http://10.0.0.1/",
  "http://169.254.169.254/latest/meta-data/",
  "http://[::1]/",
  "http://[::ffff:127.0.0.1]/",
  "http://localhost/",
  "ftp://example.com/",
])("blocks unsafe MCP transport and OAuth destination %s", async (url) => {
  await expect(mcpFetch(url)).rejects.toMatchObject({
    name: "GuardedFetchError",
  });
});
/* oxlint-enable oxc/no-async-await */
