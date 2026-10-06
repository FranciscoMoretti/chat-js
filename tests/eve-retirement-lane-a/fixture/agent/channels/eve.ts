/* oxlint-disable typescript/prefer-readonly-parameter-types -- The channel receives the runtime Request; the fixture only reads headers. */
import { eveChannel } from "eve/channels/eve";

// Fixture-only authentication: the isolated loopback worker trusts the test header.
// oxlint-disable-next-line import/no-default-export -- EVE discovers the fixture channel by default export.
export default eveChannel({
  auth: (request) => ({
    attributes: {},
    authenticator: "lane-a-fixture",
    principalId: request.headers.get("x-proof-principal") ?? "owner",
    principalType: "user",
  }),
});

/* oxlint-enable typescript/prefer-readonly-parameter-types */
