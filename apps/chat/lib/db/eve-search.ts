import { and, eq, sql } from "drizzle-orm";

import { MAX_SEARCH_QUERY_LENGTH } from "../eve/search-text";
import type { EveSearchText } from "../eve/search-text";
import { db } from "./client";
import { eveConversation, eveSearchText } from "./schema";

type SearchTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Share the binding row lock with deletion so a late backfill cannot resurrect text. */
export const writeEveSearchText = async (
  tx: SearchTransaction,
  ownerId: string,
  conversationId: string,
  entries: readonly EveSearchText[]
) => {
  const [conversation] = await tx
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound")
      )
    )
    .for("update");
  if (!conversation) {
    return;
  }
  // Bound vectors and insert batches even for unusually large pasted messages.
  const chunks = entries.flatMap((entry) => {
    const result: EveSearchText[] = [];
    for (let offset = 0; offset < entry.text.length; offset += 8000) {
      result.push({
        key: `${entry.key}:${offset}`,
        text: entry.text.slice(offset, offset + 8000 + MAX_SEARCH_QUERY_LENGTH),
      });
    }
    return result;
  });
  for (let index = 0; index < chunks.length; index += 100) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound each insert within the locked transaction.
    await tx
      .insert(eveSearchText)
      .values(
        chunks
          .slice(index, index + 100)
          .map((entry) => ({ ...entry, conversationId, ownerId }))
      )
      .onConflictDoUpdate({
        set: { text: sql`excluded.text` },
        setWhere: sql`${eveSearchText.text} is distinct from excluded.text`,
        target: [eveSearchText.conversationId, eveSearchText.key],
      });
  }
};

export const indexEveSearchText = async (
  ownerId: string,
  conversationId: string,
  entries: readonly EveSearchText[]
) => {
  if (entries.length) {
    await db.transaction((tx) =>
      writeEveSearchText(tx, ownerId, conversationId, entries)
    );
  }
};

type EveSearchResult = {
  id: string;
  conversationId: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  rank: number;
  highlightQuery: string;
};

// Modify only PostgreSQL's normalized final positive operand, never raw query syntax.
// The leading boundary excludes !'negated' terms; closing groups remain intact.
const finalSearchOperand = "(^|[ (|&])('[^']*(?:''[^']*)*')([)]*)$";
const finalUnquotedWord = /[\p{L}\p{N}]$/u;

// Read PostgreSQL's normalized operands so highlighting shares its tokenization,
// quoting and prefix rules instead of interpreting the user's query again.
const positiveOperand = /(?:^|[ (|&])'(?<term>(?:[^']|'')*)'(?<prefix>:\*)?/gu;
const markedWord = /⟦(?<word>[^⟧]*)⟧/gu;

const highlightSearchExcerpt = (excerpt: string, query: string) => {
  const terms = Array.from(query.matchAll(positiveOperand), (match) => ({
    prefix: Boolean(match.groups?.prefix),
    text: (match.groups?.term ?? "").replaceAll("''", "'"),
  }));
  return excerpt.replace(markedWord, (marked, word: string) => {
    const normalized = word.toLowerCase();
    const lengths = terms
      .filter(({ prefix, text }) =>
        prefix ? normalized.startsWith(text) : normalized === text
      )
      .map(({ text }) => text.length);
    const length = Math.max(0, ...lengths);
    return length ? `⟦${word.slice(0, length)}⟧${word.slice(length)}` : marked;
  });
};

/** One result per logical chat, with the branch containing its strongest match. */
export const searchEveConversations = async (
  ownerId: string,
  input: {
    search: string;
    cursor?: { rank: number; updatedAt: string; id: string } | null;
  }
) => {
  const { cursor } = input;
  const query = input.search.trim();
  const prefixLastWord =
    finalUnquotedWord.test(query) && query.split('"').length % 2 === 1;
  const items = await db.execute<EveSearchResult>(sql`
    with parsed as (select websearch_to_tsquery('simple', ${query}) as terms),
    query as (
      select case when ${prefixLastWord}
        then to_tsquery('simple', regexp_replace(terms::text, ${finalSearchOperand}, ${"\\1\\2:*\\3"}))
        else terms end as terms
      from parsed
    ),
    matches as (
      select chat.id, branch.id as "conversationId", chat.title, chat."updatedAt",
        2 + ts_rank_cd(to_tsvector('simple', chat.title), query.terms) as rank,
        ''::text as body
      from "EveChat" chat cross join query
      join lateral (
        select id from "EveConversation"
        where "chatId" = chat.id and "ownerId" = ${ownerId} and state = 'bound'
        order by (id = chat."activeConversationId") desc, "createdAt", id limit 1
      ) branch on true
      where chat."ownerId" = ${ownerId} and to_tsvector('simple', chat.title) @@ query.terms
      union all
      select chat.id, branch.id, chat.title, chat."updatedAt",
        ts_rank_cd(to_tsvector('simple', content.text), query.terms) as rank,
        content.text as body
      from "EveSearchText" content cross join query
      join "EveConversation" branch on branch.id = content."conversationId" and branch."ownerId" = ${ownerId} and branch.state = 'bound'
      join "EveChat" chat on chat.id = branch."chatId" and chat."ownerId" = ${ownerId}
      where content."ownerId" = ${ownerId} and to_tsvector('simple', content.text) @@ query.terms
    ), best as (
      select distinct on (id) *, max(rank) over (partition by id) as "chatRank"
      from matches
      order by id, (body <> '') desc, rank desc, "conversationId", body
    )
    select id, "conversationId", title, query.terms::text as "highlightQuery",
      to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "updatedAt",
      "chatRank"::double precision as rank,
      case when body = '' then '' else ts_headline('simple', body, query.terms,
        'StartSel=⟦, StopSel=⟧, MaxWords=32, MinWords=12, MaxFragments=1') end as excerpt
    from best cross join query
    where ${
      cursor
        ? sql`
      "chatRank" < ${cursor.rank}::double precision
      or ("chatRank" = ${cursor.rank}::double precision and "updatedAt" < ${cursor.updatedAt}::timestamp)
      or ("chatRank" = ${cursor.rank}::double precision and "updatedAt" = ${cursor.updatedAt}::timestamp and id > ${cursor.id})
    `
        : sql`true`
    }
    order by "chatRank" desc, best."updatedAt" desc, id
    limit 21
  `);
  const page = items.slice(0, 20).map(({ highlightQuery, ...item }) => ({
    ...item,
    excerpt: highlightSearchExcerpt(item.excerpt, highlightQuery),
  }));
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      items.length > 20 && last
        ? { id: last.id, rank: last.rank, updatedAt: last.updatedAt }
        : null,
  };
};
