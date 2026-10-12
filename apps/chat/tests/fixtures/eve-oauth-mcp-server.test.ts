import { expect, test } from "vitest";

import { startEveOAuthMcpServer } from "./eve-oauth-mcp-server";

test("OAuth fixture consumes UTF-8 bodies and rejects malformed registration", async () => {
  const fixture = await startEveOAuthMcpServer();
  const registration = {
    redirect_uris: ["http://localhost/callback?label=你好🌍"],
  };
  try {
    const response = await fetch(`${fixture.origin}/register`, {
      body: JSON.stringify(registration),
      method: "POST",
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject(registration);
    expect(fixture.counters.registrations).toBe(1);

    const malformed = await fetch(`${fixture.origin}/register`, {
      body: "{",
      method: "POST",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "invalid_request" });

    // setEncoding retains the BOM; JSON.parse must still reject this body.
    const bom = await fetch(`${fixture.origin}/register`, {
      body: `\uFEFF${JSON.stringify(registration)}`,
      method: "POST",
    });
    expect(bom.status).toBe(400);
    expect(await bom.json()).toEqual({ error: "invalid_request" });
    expect(fixture.counters.registrations).toBe(1);
  } finally {
    await fixture.close();
  }

  await expect(fixture.close()).rejects.toMatchObject({
    code: "ERR_SERVER_NOT_RUNNING",
  });
});
