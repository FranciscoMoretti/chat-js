import { eveChannel } from "eve/channels/eve";
import { ownsEveSession } from "../../lib/db/eve-queries";
import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  fetchFile: fetchEveChannelFile,
  authorizeFork: ({ auth, sourceSessionId }) =>
    ownsEveSession(auth.principalId, sourceSessionId),
  auth: authenticateEveGateway,
});
