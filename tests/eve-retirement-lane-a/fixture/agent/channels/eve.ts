import { eveChannel } from "eve/channels/eve";

// Fixture-only authentication: the isolated loopback worker trusts the test header.
export default eveChannel({
  auth: (request) => ({
    attributes: {},
    authenticator: "lane-a-fixture",
    principalId: request.headers.get("x-proof-principal") ?? "owner",
    principalType: "user",
  }),
});
