import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { EveSearchText } from "@/chatjs/plugins/search/search-text";
import { MAX_SEARCH_QUERY_LENGTH } from "@/chatjs/plugins/search/search-text";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { db } from "@/lib/db/client";
import { eveConversation } from "@/lib/db/schema";
import { eveSearchText } from "./search-schema";

const SEARCH_CHUNK_LENGTH = 8000;
const SEARCH_WRITE_BATCH_SIZE = 100;
const SEARCH_PAGE_SIZE = 20;
const QUOTE_PAIR_SIZE = 2;
const UNQUOTED_SEGMENT_REMAINDER = 1;
const FIRST_INDEX = 0;
const LAST_ITEM_OFFSET = -1;
const EMPTY_RESULT_COUNT = 0;

type SearchTransaction = Readonly<Pick<typeof db, "select" | "insert">>;
const splitSearchChunks = (
  entries: readonly EveSearchText[]
): EveSearchText[] =>
  entries.flatMap((entry: EveSearchText) => {
    const result: EveSearchText[] = [];
    for (
      let offset = FIRST_INDEX;
      offset < entry.text.length;
      offset += SEARCH_CHUNK_LENGTH
    ) {
      result.push({
        key: `${entry.key}:${offset}`,
        text: entry.text.slice(
          offset,
          offset + SEARCH_CHUNK_LENGTH + MAX_SEARCH_QUERY_LENGTH
        ),
      });
    }
    return result;
  });

/**
 * Writes search chunks only while the owner’s conversation binding is active.
 * The binding lock serializes the write with deletion, and existing keys are
 * updated when their indexed text changes.
 * @param {SearchTransaction} tx Transaction shared with the caller’s conversation update.
 * @param {string} ownerId Owner whose active conversation is being indexed.
 * @param {string} conversationId Bound conversation that owns the chunks.
 * @param {readonly EveSearchText[]} entries Search keys and text chunks to persist.
 */
const writeEveSearchText = async (
  tx: SearchTransaction,
  ownerId: string,
  conversationId: string,
  entries: readonly EveSearchText[]
): Promise<void> => {
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
  const hasConversation = Boolean(conversation);
  if (!hasConversation) {
    return;
  }
  // Bound vectors and insert batches even for unusually large pasted messages.
  const chunks = splitSearchChunks(entries);
  for (
    let index = FIRST_INDEX;
    index < chunks.length;
    index += SEARCH_WRITE_BATCH_SIZE
  ) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Insert at most SEARCH_WRITE_BATCH_SIZE rows per query on the locked transaction; search-backfill awaits each committed batch before advancing.
    await tx
      .insert(eveSearchText)
      .values(
        chunks
          .slice(index, index + SEARCH_WRITE_BATCH_SIZE)
          .map((entry: EveSearchText) => ({
            ...entry,
            conversationId,
            ownerId,
          }))
      )
      .onConflictDoUpdate({
        set: { text: sql`excluded.text` },
        setWhere: sql`${eveSearchText.text} is distinct from excluded.text`,
        target: [eveSearchText.conversationId, eveSearchText.key],
      });
  }
};

const indexEveSearchText = async (
  ownerId: string,
  conversationId: string,
  entries: readonly EveSearchText[]
): Promise<void> => {
  if (entries.length > EMPTY_RESULT_COUNT) {
    await db.transaction(async (tx: SearchTransaction) => {
      await writeEveSearchText(tx, ownerId, conversationId, entries);
    });
  }
};

const eveSearchResult = z.object({
  id: z.string(),
  conversationId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  updatedAt: z.string(),
  rank: z.number(),
  highlightQuery: z.string(),
  highlightWords: z.record(z.string(), z.string()),
});
type EveSearchResult = z.infer<typeof eveSearchResult>;

// Modify only PostgreSQL's normalized final positive operand, never raw query syntax.
// The leading boundary excludes !'negated' terms; closing groups remain intact.
const finalSearchOperand = "(^|[ (|&])('[^']*(?:''[^']*)*')([)]*)$";
const finalUnquotedWord = /[\p{L}\p{N}]$/u;

// Read PostgreSQL's normalized operands so highlighting shares its tokenization,
// quoting and prefix rules instead of interpreting the user's query again.
const queryToken = /!|[()]|'(?<term>(?:[^'\\]|\\.|'')*)'(?<prefix>:\*)?/gu;
const escapedQueryCharacter = /\\(?<character>.)/gu;
const markedWord = /⟦(?<word>[^⟧]*)⟧/gu;

const highlightSearchExcerpt = (
  excerpt: string,
  query: string,
  words: Readonly<Record<string, string>>
): string => {
  const terms: { prefix: boolean; text: string }[] = [];
  const groups = [false];
  let negateNext = false;
  for (const token of query.matchAll(queryToken)) {
    const negated = (groups.at(LAST_ITEM_OFFSET) ?? false) !== negateNext;
    if (token[FIRST_INDEX] === "!") {
      negateNext = !negateNext;
      continue;
    }
    if (token[FIRST_INDEX] === "(") {
      groups.push(negated);
    } else if (token[FIRST_INDEX] === ")") {
      groups.pop();
    } else if (!negated && isNonEmptyString(token.groups?.term)) {
      terms.push({
        prefix: Boolean(token.groups.prefix),
        text: token.groups.term
          .replace(escapedQueryCharacter, "$1")
          .replaceAll("''", "'"),
      });
    }
    negateNext = false;
  }
  return excerpt.replace(markedWord, (marked, word: string) => {
    const normalized = words[word] ?? word;
    const lengths = terms
      .filter(
        ({ prefix, text }: Readonly<{ prefix: boolean; text: string }>) => {
          if (prefix) {
            return normalized.startsWith(text);
          }
          return normalized === text;
        }
      )
      .map(
        ({ text }: Readonly<{ prefix: boolean; text: string }>) => text.length
      );
    const length = Math.max(EMPTY_RESULT_COUNT, ...lengths);

    if (length) {
      return `⟦${word.slice(FIRST_INDEX, length)}⟧${word.slice(length)}`;
    }
    return marked;
  });
};

/**
 * Searches an owner’s bound conversations and returns one ranked result per chat.
 * The cursor continues after a result using rank, update time, and chat ID.
 * @param {string} ownerId Owner whose private conversation and search text rows are queried.
 * @param {{ search: string; cursor?: { rank: number; updatedAt: string; id: string } | null }} input Search text and optional continuation cursor.
 * @returns {Promise<{ items: Array<Omit<EveSearchResult, "highlightQuery" | "highlightWords">>; nextCursor: { id: string; rank: number; updatedAt: string } | null }>} A page of highlighted chat results and a cursor when more results exist.
 */
const searchEveConversations = async (
  ownerId: string,
  input: {
    readonly search: string;
    readonly cursor?: {
      readonly rank: number;
      readonly updatedAt: string;
      readonly id: string;
    } | null;
  }
): Promise<{
  items: Omit<EveSearchResult, "highlightQuery" | "highlightWords">[];
  nextCursor: { id: string; rank: number; updatedAt: string } | null;
}> => {
  const { cursor } = input;
  const query = input.search.trim();
  const prefixLastWord =
    finalUnquotedWord.test(query) &&
    query.split('"').length % QUOTE_PAIR_SIZE === UNQUOTED_SEGMENT_REMAINDER;
  const rows = await db.execute(sql`
    with parsed as (select websearch_to_tsquery('simple', ${query}) as terms),
    query as (
      select case when ${prefixLastWord}
        then to_tsquery('simple', regexp_replace(terms::text, ${finalSearchOperand}, ${String.raw`\1\2:*\3`}))
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
    ), headlines as (
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
    )
    -- Use the same dictionary as the search vector, including its locale rules.
    select headlines.*, (
      select coalesce(jsonb_object_agg(word[1], (ts_lexize('simple', word[1]))[1]), '{}'::jsonb)
      from regexp_matches(excerpt, '⟦([^⟧]*)⟧', 'g') as word
    ) as "highlightWords"
    from headlines
    order by rank desc, "updatedAt" desc, id
  `);
  const items = z.array(eveSearchResult).parse(rows);
  const page = items
    .slice(FIRST_INDEX, SEARCH_PAGE_SIZE)
    .map(
      ({
        highlightQuery,
        highlightWords,
        ...item
      }: ReadonlyNativeSurface<EveSearchResult>) => ({
        ...item,
        excerpt: highlightSearchExcerpt(
          item.excerpt,
          highlightQuery,
          highlightWords
        ),
      })
    );
  const last = page.at(LAST_ITEM_OFFSET);
  return {
    items: page,
    nextCursor:
      items.length > SEARCH_PAGE_SIZE && last
        ? { id: last.id, rank: last.rank, updatedAt: last.updatedAt }
        : null,
  };
};
export { indexEveSearchText, searchEveConversations, writeEveSearchText };
