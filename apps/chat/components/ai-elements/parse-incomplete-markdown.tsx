"use client";

const incompleteLinkOrImagePattern = /(?<marker>!?\[)[^\]]*$/u;
const incompleteBoldPattern = /\*\*[^*]*$/u;
const incompleteItalicPattern = /__[^_]*$/u;
const incompleteSingleAsteriskPattern = /\*[^*]*$/u;
const incompleteSingleUnderscorePattern = /_[^_]*$/u;
const incompleteInlineCodePattern = /`[^`]*$/u;
const incompleteStrikethroughPattern = /~~[^~]*$/u;
const boldPattern = /\*\*/gu;
const italicPattern = /__/gu;
const tripleBacktickPattern = /```/gu;
const strikethroughPattern = /~~/gu;
/* oxlint-disable no-magic-numbers, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types -- countMatches: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including value.match(pattern)?.length); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including pattern: RegExp). */

const countMatches = (value: string, pattern: RegExp): number =>
  value.match(pattern)?.length ?? 0;
/* oxlint-enable no-magic-numbers, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers -- countStandaloneMarkers: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1). */

const countStandaloneMarkers = (value: string, marker: string): number => {
  // oxlint-disable-next-line typescript/no-misused-spread -- #586: This transformation intentionally iterates Unicode code points; changing to graphemes or UTF-16 units would alter its existing text contract.
  const characters = [...value];
  let count = 0;

  for (let index = 0; index < characters.length; index += 1) {
    if (
      characters[index] === marker &&
      characters[index - 1] !== marker &&
      characters[index + 1] !== marker
    ) {
      count += 1;
    }
  }

  return count;
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers -- countStandaloneBackticks: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1). */

const countStandaloneBackticks = (value: string): number => {
  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "`") {
      const isPartOfTripleBacktick =
        value.slice(index, index + 3) === "```" ||
        value.slice(index - 1, index + 2) === "```" ||
        value.slice(index - 2, index + 1) === "```";

      if (!isPartOfTripleBacktick) {
        count += 1;
      }
    }
  }

  return count;
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- appendClosingMarker: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const appendClosingMarker = ({
  closingMarker,
  incompletePattern,
  markerPattern,
  value,
}: {
  closingMarker: string;
  incompletePattern: RegExp;
  markerPattern: RegExp;
  value: string;
}): string => {
  if (
    incompletePattern.test(value) &&
    countMatches(value, markerPattern) % 2 === 1
  ) {
    return `${value}${closingMarker}`;
  }

  return value;
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- appendClosingStandaloneMarker: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const appendClosingStandaloneMarker = ({
  incompletePattern,
  marker,
  value,
}: {
  incompletePattern: RegExp;
  marker: string;
  value: string;
}): string => {
  if (
    incompletePattern.test(value) &&
    countStandaloneMarkers(value, marker) % 2 === 1
  ) {
    return `${value}${marker}`;
  }

  return value;
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers -- completeInlineCode: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2). */

const completeInlineCode = (value: string): string => {
  const isInsideIncompleteCodeBlock =
    countMatches(value, tripleBacktickPattern) % 2 === 1;

  if (
    incompleteInlineCodePattern.test(value) &&
    !isInsideIncompleteCodeBlock &&
    countStandaloneBackticks(value) % 2 === 1
  ) {
    return `${value}\``;
  }

  return value;
};
/* oxlint-enable no-magic-numbers */
/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, no-ternary, oxc/no-optional-chaining, typescript/strict-boolean-expressions -- parseIncompleteMarkdown: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including linkMatch?.groups?.marker); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including linkMatch?.groups?.marker). */

/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
export const parseIncompleteMarkdown = (text: string): string => {
  if (!text || typeof text !== "string") {
    return text;
  }

  const linkMatch = incompleteLinkOrImagePattern.exec(text);
  let result = linkMatch?.groups?.marker
    ? text.slice(0, text.lastIndexOf(linkMatch.groups.marker))
    : text;

  result = appendClosingMarker({
    closingMarker: "**",
    incompletePattern: incompleteBoldPattern,
    markerPattern: boldPattern,
    value: result,
  });
  result = appendClosingMarker({
    closingMarker: "__",
    incompletePattern: incompleteItalicPattern,
    markerPattern: italicPattern,
    value: result,
  });
  result = appendClosingStandaloneMarker({
    incompletePattern: incompleteSingleAsteriskPattern,
    marker: "*",
    value: result,
  });
  result = appendClosingStandaloneMarker({
    incompletePattern: incompleteSingleUnderscorePattern,
    marker: "_",
    value: result,
  });
  result = completeInlineCode(result);

  return appendClosingMarker({
    closingMarker: "~~",
    incompletePattern: incompleteStrikethroughPattern,
    markerPattern: strikethroughPattern,
    value: result,
  });
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, no-ternary, oxc/no-optional-chaining, typescript/strict-boolean-expressions */
