import { z } from "zod";

// The browser, Next server and worker use the same HTTPS origin. The test
// process serves just the fixture on the port routed to that origin.
export const liveMcpFixtureAddress = () => {
  const result = z
    .object({
      CHATJS_TEST_MCP_ORIGIN: z.url({ protocol: /^https$/u }),
      CHATJS_TEST_MCP_PORT: z.coerce.number().int().positive().max(65_535),
    })
    .safeParse(process.env);
  if (!result.success) {
    throw new Error(
      "Set CHATJS_TEST_MCP_ORIGIN to the dedicated HTTPS fixture origin and CHATJS_TEST_MCP_PORT to its local fixture port."
    );
  }
  const url = new URL(result.data.CHATJS_TEST_MCP_ORIGIN);
  if (url.href !== `${url.origin}/`) {
    throw new Error(
      "CHATJS_TEST_MCP_ORIGIN must be an origin without a path, credentials, query, or fragment."
    );
  }
  return { origin: url.origin, port: result.data.CHATJS_TEST_MCP_PORT };
};
