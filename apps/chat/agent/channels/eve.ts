import { eveChannel } from "eve/channels/eve";
import { nativeBranchHistory } from "../../lib/eve/branch-history";

export default eveChannel({
  auth: [
    async (request) => {
      const { authenticateEveGateway } =
        await import("../../lib/eve/gateway-auth");
      return await authenticateEveGateway(request);
    },
    async (request) => {
      const { sessionProfiles } =
        await import("../../integrations/chat/session-profiles");
      for (const profile of sessionProfiles) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Authenticators run in order and stop at the first match, as in the native channel auth chain.
        const identity = await profile.authenticate?.(request);
        if (identity) {
          return identity;
        }
      }
      return null;
    },
  ],
  fetchFile: async (...args) => {
    const { fetchEveChannelFile } = await import("../../lib/eve/channel-files");
    return await fetchEveChannelFile(...args);
  },
  onMessage: async ({ eve }) => {
    const reservationId = eve.caller?.attributes?.chatjsReservationId;
    if (eve.sessionId !== undefined || typeof reservationId !== "string") {
      return { auth: eve.caller };
    }
    if (!eve.caller) {
      throw new Error("Branch history requires an authenticated owner.");
    }
    const { resolveEveBranchHistory } =
      await import("../../lib/db/eve-current-copy");
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
