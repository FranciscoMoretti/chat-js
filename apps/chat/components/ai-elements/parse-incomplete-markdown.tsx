"use client";

// Markdown delimiters occur in opening/closing pairs. Derive offsets from their
// spelling so code-point and UTF-16 scans keep their existing boundary behavior.
const delimitersPerPair = 2;
const textStartOffset = 0;
const unmatchedDelimiterCount = 1;
const inlineCodeMarker = "`";
const doubleCodeMarker = "``";
const codeFenceMarker = "```";

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
const inlineCodePattern = /`/gu;
const standaloneAsteriskPattern = /(?<!\*)\*(?!\*)/gu;
const standaloneUnderscorePattern = /(?<!_)_(?!_)/gu;
const strikethroughPattern = /~~/gu;

const countMatches = (value: string, pattern: Readonly<RegExp>): number =>
  [...value.matchAll(pattern)].length;

const countStandaloneBackticks = (value: string): number =>
  [...value.matchAll(inlineCodePattern)].filter(
    ({ index }: { readonly index: number }) =>
      value.slice(index, index + codeFenceMarker.length) !== codeFenceMarker &&
      value.slice(
        index - inlineCodeMarker.length,
        index + doubleCodeMarker.length
      ) !== codeFenceMarker &&
      value.slice(
        index - doubleCodeMarker.length,
        index + inlineCodeMarker.length
      ) !== codeFenceMarker
  ).length;

const appendClosingMarker = ({
  closingMarker,
  incompletePattern,
  markerPattern,
  value,
}: {
  readonly closingMarker: string;
  readonly incompletePattern: Readonly<RegExp>;
  readonly markerPattern: Readonly<RegExp>;
  readonly value: string;
}): string => {
  if (
    incompletePattern.test(value) &&
    countMatches(value, markerPattern) % delimitersPerPair ===
      unmatchedDelimiterCount
  ) {
    return `${value}${closingMarker}`;
  }

  return value;
};

const completeInlineCode = (value: string): string => {
  const isInsideIncompleteCodeBlock =
    countMatches(value, tripleBacktickPattern) % delimitersPerPair ===
    unmatchedDelimiterCount;

  if (
    incompleteInlineCodePattern.test(value) &&
    !isInsideIncompleteCodeBlock &&
    countStandaloneBackticks(value) % delimitersPerPair ===
      unmatchedDelimiterCount
  ) {
    return `${value}\``;
  }

  return value;
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (parseIncompleteMarkdown); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 * @param {string} text Streamed Markdown text.
 * @returns {string} Text with unfinished links removed and unmatched delimiters closed.
 */
export const parseIncompleteMarkdown = (text: string): string => {
  if (text === "" || typeof text !== "string") {
    return text;
  }

  const incompleteMarker =
    incompleteLinkOrImagePattern.exec(text)?.groups?.marker;
  let result =
    typeof incompleteMarker === "string" && incompleteMarker !== ""
      ? text.slice(textStartOffset, text.lastIndexOf(incompleteMarker))
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
  result = appendClosingMarker({
    closingMarker: "*",
    incompletePattern: incompleteSingleAsteriskPattern,
    markerPattern: standaloneAsteriskPattern,
    value: result,
  });
  result = appendClosingMarker({
    closingMarker: "_",
    incompletePattern: incompleteSingleUnderscorePattern,
    markerPattern: standaloneUnderscorePattern,
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
