import { eveLocalResourceRoute } from "../../lib/eve/local-resource-route";
import { eveChannel } from "eve/channels/eve";

import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { ownsEveSession } from "../../lib/db/eve-queries";
import { resolveAcceptedEveCopySeed } from "../../lib/db/eve-copy-dispatch";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

const channel = eveChannel({
  auth: authenticateEveGateway,
  authorizeFork: async ({ auth, sourceSessionId }): Promise<boolean> =>
    await ownsEveSession(auth.principalId, sourceSessionId),
  fetchFile: fetchEveChannelFile,
  resolveSeed: async ({ auth, operationId }) => {
    const seed = await resolveAcceptedEveCopySeed(
      auth.principalId,
      operationId
    );
    if (seed.attachments !== "channel") {
      throw new Error(
        "Accepted copies require destination channel attachments."
      );
    }
    return { ...seed, attachments: seed.attachments };
  },
});

export default {
  ...channel,
  routes: [...channel.routes, eveLocalResourceRoute],
};
