import { eveChannel } from "eve/channels/eve";

// oxlint-disable-next-line import/no-default-export -- EVE discovers this authored fixture through its required default export.
export default eveChannel({
  auth: () => ({
    attributes: {},
    authenticator: "retirement-fixture",
    principalId: "owner",
    principalType: "user",
  }),
});
