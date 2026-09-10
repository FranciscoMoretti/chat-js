import { eveChannel } from "eve/channels/eve";
import { ownsEveSession } from "../../lib/db/eve-queries";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  authorizeFork: ({ auth, sourceSessionId }) =>
    ownsEveSession(auth.principalId, sourceSessionId),
  auth: authenticateEveGateway,
});
