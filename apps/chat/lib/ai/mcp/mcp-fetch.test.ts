import { expect, test } from "vitest";

import { mcpFetch } from "./mcp-fetch";

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): test.each([ "http://127.0.0.1/", "http://10.0.0.1/", "http://169.254.169.254/latest/m sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
