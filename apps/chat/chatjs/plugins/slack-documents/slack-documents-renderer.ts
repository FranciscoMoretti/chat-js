import { and, eq } from "drizzle-orm";
import { defineSlackRenderer } from "eve/channels/slack";
import { db } from "@/lib/db/client";
import { eveDocumentWriteResult } from "@/chatjs/core/documents/contracts";
import { toolResultSchema } from "@/lib/eve/tool-result";
import { bindSlackSession } from "./slack-store";
import { slackDocumentRevision } from "./slack-schema";

/** Deliver the committed revision in its Slack conversation; never publish a web editor URL. */
export const slackDocumentsRenderer = defineSlackRenderer({
  events: {
    "call.settled": async (event, context, renderDefault) => {
      await renderDefault();
      const receipt = toolResultSchema.safeParse(event.data.output);
      if (!receipt.success || receipt.data.status !== "success") {
        return;
      }
      const result = eveDocumentWriteResult.safeParse(receipt.data.output);
      if (!result.success || event.data.outcome !== "completed") {
        return;
      }
      const scope = await bindSlackSession(context.session);
      const rows = await db
        .select()
        .from(slackDocumentRevision)
        .where(
          and(
            eq(slackDocumentRevision.id, result.data.revisionId),
            eq(slackDocumentRevision.documentId, result.data.documentId),
            eq(slackDocumentRevision.conversationId, scope.conversationId),
            eq(slackDocumentRevision.teamId, scope.teamId)
          )
        );
      const revision = rows.at(0);
      if (revision === undefined) {
        throw new Error(
          "Slack document delivery requires an authorized revision."
        );
      }
      const extension = revision.kind === "text" ? "md" : "txt";
      await context.channel.thread.post({
        markdown: `Saved document: ${revision.title}`,
        files: [
          {
            data: Buffer.from(revision.content),
            filename: `${revision.documentId}.${extension}`,
            mimeType: "text/plain",
          },
        ],
      });
    },
  },
});
