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

const countMatches = (value: string, pattern: RegExp): number =>
  value.match(pattern)?.length ?? 0;

const countStandaloneMarkers = (value: string, marker: string): number => {
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

const countStandaloneBackticks = (value: string): number => {
  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "`") {
      continue;
    }

    const isPartOfTripleBacktick =
      value.slice(index, index + 3) === "```" ||
      value.slice(index - 1, index + 2) === "```" ||
      value.slice(index - 2, index + 1) === "```";

    if (!isPartOfTripleBacktick) {
      count += 1;
    }
  }

  return count;
};

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

/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
export const parseIncompleteMarkdown = (text: string): string => {
  if (!text || typeof text !== "string") {
    return text;
  }

  const linkMatch = text.match(incompleteLinkOrImagePattern);
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
