import { eveChannel } from "eve/channels/eve";

export default eveChannel({
  auth: () => ({
    attributes: {},
    authenticator: "retirement-fixture",
    principalId: "owner",
    principalType: "user",
  }),
});
