import { eveChannel } from "eve/channels/eve";

import { resolveAcceptedEveCopySeed } from "../../lib/db/eve-copy-dispatch";
import { ownsEveSession } from "../../lib/db/eve-queries";
import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  resolveSeed: ({ auth, operationId }) =>
    resolveAcceptedEveCopySeed(auth.principalId, operationId),
  fetchFile: fetchEveChannelFile,
  authorizeFork: ({ auth, sourceSessionId }) =>
    ownsEveSession(auth.principalId, sourceSessionId),
  auth: authenticateEveGateway,
});
