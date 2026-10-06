import { eveChannel } from "eve/channels/eve";

// oxlint-disable-next-line import/no-default-export -- EVE discovers channels through their default exports.
export default eveChannel({
  auth: () => ({
    attributes: {},
    authenticator: "retirement-fixture",
    principalId: "owner",
    principalType: "user",
  }),
});
