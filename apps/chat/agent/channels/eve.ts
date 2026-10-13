import { eveChannel } from "eve/channels/eve";

import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { ownsEveSession } from "../../lib/db/eve-queries";
import { resolveAcceptedEveCopySeed } from "../../lib/db/eve-copy-dispatch";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  auth: authenticateEveGateway,
  authorizeFork: async ({ auth, sourceSessionId }): Promise<boolean> =>
    await ownsEveSession(auth.principalId, sourceSessionId),
  fetchFile: fetchEveChannelFile,
  resolveSeed: async ({ auth, operationId }) =>
    await resolveAcceptedEveCopySeed(auth.principalId, operationId),
});
