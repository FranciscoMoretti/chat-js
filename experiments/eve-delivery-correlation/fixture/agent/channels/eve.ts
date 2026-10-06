import { GET } from "eve/channels";
import { eveChannel } from "eve/channels/eve";

const channel = eveChannel({
  auth: () => ({
    attributes: {},
    authenticator: "retirement-fixture",
    principalId: "owner",
    principalType: "user",
  }),
});

// oxlint-disable-next-line require-await, typescript/require-await -- The native HTTP route requires an asynchronous response; the fixture reads only its own process identity.
const processResponse = async (): Promise<Response> =>
  Response.json({ pid: process.pid });
const fixtureChannel = {
  ...channel,
  routes: [...channel.routes, GET("/proof/process", processResponse)],
};
// oxlint-disable-next-line import/no-default-export -- EVE discovers this authored fixture through its required default export.
export default fixtureChannel;
