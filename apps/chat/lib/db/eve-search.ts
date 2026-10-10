import { and, eq, sql } from "drizzle-orm";

import type { EveSearchText } from "@/lib/eve/search-text";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/eve/search-text";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { db } from "./client";
/* oxlint-disable sort-imports -- Keep the native client pool initialized before schema table/custom-type construction; schema loads env-backed encryption definitions and executes pgTable builders. */
import { eveConversation, eveSearchText } from "./schema";
/* oxlint-enable sort-imports */

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeEveSearchText's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-params --
max-params (#511): writeEveSearchText keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
*/
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
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound each insert within the locked transaction.
    await tx
      .insert(eveSearchText)
      .values(
        chunks
          .slice(index, index + SEARCH_WRITE_BATCH_SIZE)
          // oxlint-disable-next-line oxc/no-map-spread -- #541: Construct persisted search rows and highlighted result views without mutating source chunks or query records. Preserve persisted entry keys and overrides; explicit fields would drop extra enumerable source properties.
          .map((entry: EveSearchText) => ({
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Persist the existing source chunk fields before the conversation and owner overrides; Object.assign conflicts with prefer-object-spread.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve indexEveSearchText's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params */

/* oxlint-disable typescript/promise-function-async --

typescript/promise-function-async (#606): indexEveSearchText preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
const indexEveSearchText = async (
  ownerId: string,
  conversationId: string,
  entries: readonly EveSearchText[]
): Promise<void> => {
  if (entries.length > EMPTY_RESULT_COUNT) {
    await db.transaction((tx: SearchTransaction) =>
      writeEveSearchText(tx, ownerId, conversationId, entries)
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): db.execute<EveSearchResult> requires Record<string, unknown>; this object alias supplies implicit index assignability that an equivalent interface lacks.
 */
type EveSearchResult = {
  id: string;
  conversationId: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  rank: number;
  highlightQuery: string;
  highlightWords: Record<string, string>;
};
/* oxlint-enable typescript/consistent-type-definitions */

// Modify only PostgreSQL's normalized final positive operand, never raw query syntax.
// The leading boundary excludes !'negated' terms; closing groups remain intact.
const finalSearchOperand = "(^|[ (|&])('[^']*(?:''[^']*)*')([)]*)$";
const finalUnquotedWord = /[\p{L}\p{N}]$/u;

// Read PostgreSQL's normalized operands so highlighting shares its tokenization,
// quoting and prefix rules instead of interpreting the user's query again.
const queryToken = /!|[()]|'(?<term>(?:[^'\\]|\\.|'')*)'(?<prefix>:\*)?/gu;
const escapedQueryCharacter = /\\(?<character>.)/gu;
const markedWord = /⟦(?<word>[^⟧]*)⟧/gu;

/* oxlint-disable max-statements, no-continue, typescript/strict-boolean-expressions --
 * max-statements (#512): highlightSearchExcerpt keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): highlightSearchExcerpt skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 *
 * typescript/strict-boolean-expressions (#610): highlightSearchExcerpt intentionally keeps the existing falsy-value behavior of token.groups?.term; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading term from token.groups; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    } else if (!negated && token.groups?.term) {
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve searchEveConversations's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-continue, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, unicorn/no-null --
max-lines-per-function (#510): searchEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.

unicorn/no-null (#570): searchEveConversations preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
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
  const items = await db.execute<EveSearchResult>(sql`
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
      // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  const page = items
    .slice(FIRST_INDEX, SEARCH_PAGE_SIZE)
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Construct persisted search rows and highlighted result views without mutating source chunks or query records. Preserve the result own-key snapshot after excluding highlight fields.
    .map(
      ({
        highlightQuery,
        highlightWords,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Preserve the original own-key exclusion of highlight fields when forwarding the search result.
        ...item
      }: ReadonlyNativeSurface<EveSearchResult>) => ({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      // oxlint-disable-next-line no-ternary -- Keep nextCursor as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      items.length > SEARCH_PAGE_SIZE && last
        ? { id: last.id, rank: last.rank, updatedAt: last.updatedAt }
        : null,
  };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (indexEveSearchText, searchEveConversations, writeEveSearchText); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, unicorn/no-null */
export { indexEveSearchText, searchEveConversations, writeEveSearchText };
/* oxlint-enable import/no-named-export */
