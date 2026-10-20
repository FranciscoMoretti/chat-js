import { authenticateDisposableGuest } from "../../lib/eve/disposable-guest-auth";
import { eveChannel } from "eve/channels/eve";

import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { readEveSessionMapping } from "../../lib/db/eve-queries";
import { resolveEveCurrentCopySeed } from "../../lib/db/eve-current-copy";
import { resolveAcceptedEveCopySeed } from "../../lib/db/eve-copy-dispatch";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  auth: [authenticateEveGateway, authenticateDisposableGuest],
  fetchFile: fetchEveChannelFile,
  resolveSeed: async ({ auth, operationId }) => {
    const reservation = await readEveSessionMapping({
      reservationId: operationId,
    });
    const seed =
      reservation?.creationKind === "copy"
        ? await resolveAcceptedEveCopySeed(auth.principalId, operationId)
        : await resolveEveCurrentCopySeed(auth.principalId, operationId);
    if (seed.attachments !== "channel") {
      throw new Error(
        "Accepted copies require destination channel attachments."
      );
    }
    return { ...seed, attachments: seed.attachments };
  },
});
