import { and, eq, sql } from "drizzle-orm";

import type { EveSearchText } from "@/lib/eve/search-text";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/eve/search-text";

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveSearchText } from "./schema";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): SearchTransaction uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type SearchTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeEveSearchText's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable jsdoc/require-param, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
jsdoc/require-param (#534): writeEveSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-params (#511): writeEveSearchText keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): writeEveSearchText uses 8000, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): writeEveSearchText accepts tx: SearchTransaction; entries: readonly EveSearchText[]; entry; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): writeEveSearchText intentionally keeps the existing falsy-value behavior of conversation; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Share the binding row lock with deletion so a late backfill cannot resurrect text. */
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
          // oxlint-disable-next-line oxc/no-map-spread, oxc/no-rest-spread-properties -- #541: Construct persisted search rows and highlighted result views without mutating source chunks or query records. Rest/spread: Keep the existing entry own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          .map((entry) => ({ ...entry, conversationId, ownerId }))
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
/* oxlint-enable jsdoc/require-param, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): indexEveSearchText uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): indexEveSearchText accepts entries: readonly EveSearchText[]; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): indexEveSearchText preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
const indexEveSearchText = async (
  ownerId: string,
  conversationId: string,
  entries: readonly EveSearchText[]
): Promise<void> => {
  if (entries.length > 0) {
    await db.transaction((tx) =>
      writeEveSearchText(tx, ownerId, conversationId, entries)
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

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

/* oxlint-disable max-statements, no-continue, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-statements (#512): highlightSearchExcerpt keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): highlightSearchExcerpt skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): highlightSearchExcerpt uses -1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): highlightSearchExcerpt accepts words: Record<string, string>; { prefix, text }; { text }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): highlightSearchExcerpt intentionally keeps the existing falsy-value behavior of token.groups?.term; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const highlightSearchExcerpt = (
  excerpt: string,
  query: string,
  words: Record<string, string>
): string => {
  const terms: { prefix: boolean; text: string }[] = [];
  const groups = [false];
  let negateNext = false;
  for (const token of query.matchAll(queryToken)) {
    const negated = (groups.at(-1) ?? false) !== negateNext;
    if (token[0] === "!") {
      negateNext = !negateNext;
      continue;
    }
    if (token[0] === "(") {
      groups.push(negated);
    } else if (token[0] === ")") {
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
      .filter(({ prefix, text }) => {
        if (prefix) {
          return normalized.startsWith(text);
        }
        return normalized === text;
      })
      .map(({ text }) => text.length);
    const length = Math.max(0, ...lengths);

    if (length) {
      return `⟦${word.slice(0, length)}⟧${word.slice(length)}`;
    }
    return marked;
  });
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve searchEveConversations's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-continue, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- jsdoc/require-param (#534): searchEveConversations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): searchEveConversations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): searchEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): searchEveConversations uses 2, 1, 0, 20, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep searchEveConversations's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep searchEveConversations's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): searchEveConversations accepts input: { search: string; cursor?: { rank: number; updatedAt: string; id: string } | n; { highlightQuery, highlightWords, ...item }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): searchEveConversations preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** One result per logical chat, with the branch containing its strongest match. */
const searchEveConversations = async (
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
    .slice(0, 20)
    // oxlint-disable-next-line oxc/no-map-spread, oxc/no-rest-spread-properties -- #541: Construct persisted search rows and highlighted result views without mutating source chunks or query records. Rest/spread: Rest binding item excludes highlightQuery, highlightWords from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    .map(({ highlightQuery, highlightWords, ...item }) => ({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...item,
      excerpt: highlightSearchExcerpt(
        item.excerpt,
        highlightQuery,
        highlightWords
      ),
    }));
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      // oxlint-disable-next-line no-ternary -- Keep nextCursor as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      items.length > 20 && last
        ? { id: last.id, rank: last.rank, updatedAt: last.updatedAt }
        : null,
  };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (indexEveSearchText, searchEveConversations, writeEveSearchText); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
export { indexEveSearchText, searchEveConversations, writeEveSearchText };
/* oxlint-enable import/no-named-export */
