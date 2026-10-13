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
// oxlint-disable-next-line require-await -- The EVE route handler contract requires a Promise response even for this synchronous PID probe.
const processResponse = async (): Promise<Response> =>
  Response.json({ pid: process.pid });
const fixtureChannel = {
  ...channel,
  routes: [...channel.routes, GET("/proof/process", processResponse)],
};
export default fixtureChannel;
