import { inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { eveConversation } from "./schema";

/** Caller holds the owner-family lock. Keep surviving document roots and their exact ancestry. */
export const unretainedEveDocumentRevisionIds = (
  ownerId: string,
  conversationIds: readonly string[]
): SQL => sql`(with recursive members as (
  select "id", "state" from "EveConversation" where "ownerId" = ${ownerId}
  and "workspaceId" in (
    select "workspaceId" from "EveConversation"
    where "ownerId" = ${ownerId} and ${inArray(eveConversation.id, [...conversationIds])}
  )
), retained(id) as (
  (
    select revision."id" from "EveDocumentRevision" revision
    join members member on member."id" = revision."conversationId"
    where revision."ownerId" = ${ownerId}
      and member.state not in ('deleting', 'deleted')
    union select "revisionId" from "EveDocumentHead" where "ownerId" = ${ownerId} and "conversationId" in (select id from members)
    union select "revisionId" from "EveDocumentCheckpointEntry" where "ownerId" = ${ownerId} and "conversationId" in (select id from members)
    union select "revisionId" from "EveNamedDocumentCheckpointEntry" where "ownerId" = ${ownerId} and "conversationId" in (select id from members)
    union select "revisionId" from "EveImportedDocumentCheckpointEntry" where "ownerId" = ${ownerId} and "conversationId" in (select id from members)
  )
  union
  select revision."parentRevisionId" from "EveDocumentRevision" revision
  join retained on retained.id = revision."id"
  where revision."ownerId" = ${ownerId} and revision."parentRevisionId" is not null
)
select revision."id" from "EveDocumentRevision" revision
join members member on member."id" = revision."conversationId"
where revision."ownerId" = ${ownerId}
  and member.state in ('deleting', 'deleted')
  and not exists (select 1 from retained where retained.id = revision."id")
)`;
