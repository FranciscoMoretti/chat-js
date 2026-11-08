import { sessionProfiles } from "../../integrations/chat/session-profiles";
import { eveChannel } from "eve/channels/eve";
import { nativeBranchHistory } from "../../lib/eve/branch-history";

import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { resolveEveBranchHistory } from "../../lib/db/eve-current-copy";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  auth: [
    authenticateEveGateway,
    ...sessionProfiles.map((profile) => profile.authenticate),
  ],
  fetchFile: fetchEveChannelFile,
  onMessage: async ({ eve }) => {
    const reservationId = eve.caller?.attributes?.chatjsReservationId;
    if (eve.sessionId !== undefined || typeof reservationId !== "string") {
      return { auth: eve.caller };
    }
    if (!eve.caller) {
      throw new Error("Branch history requires an authenticated owner.");
    }
    const capture = await resolveEveBranchHistory(
      eve.caller.principalId,
      reservationId
    );
    return {
      auth: eve.caller,
      ...(capture === null ? {} : { history: nativeBranchHistory(capture) }),
    };
  },
});
