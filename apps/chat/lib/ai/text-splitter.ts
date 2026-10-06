import { TextSplitter } from "./text-splitter-base";
import type { TextSplitterParams } from "./text-splitter-base";

/* oxlint-disable import/no-named-export -- Keep the named type bindings (RecursiveCharacterTextSplitterParams); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export interface RecursiveCharacterTextSplitterParams extends TextSplitterParams {
  separators: string[];
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (RecursiveCharacterTextSplitter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-statements (#512): RecursiveCharacterTextSplitter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): RecursiveCharacterTextSplitter uses -1, 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): RecursiveCharacterTextSplitter accepts fields?: Partial<RecursiveCharacterTextSplitterParams>; parts: string[]; splits: string[]; finalChunks: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): RecursiveCharacterTextSplitter preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export class RecursiveCharacterTextSplitter
  extends TextSplitter
  implements RecursiveCharacterTextSplitterParams
{
  public separators: string[] = ["\n\n", "\n", ".", ",", ">", "<", " ", ""];
  public constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
    super(fields);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Constructor fields is an optional public argument; the no-options constructor retains each established default, so direct access is not equivalent. The app guidance prefers optional chaining.
    this.separators = fields?.separators ?? this.separators;
  }
  private findBestSeparator(text: string): string {
    for (const separator of this.separators) {
      if (separator === "" || text.includes(separator)) {
        return separator;
      }
    }
    return this.separators.at(-1) ?? "";
  }
  private static combineParenthesizedPhrases(parts: string[]): string[] {
    const combined: string[] = [];
    for (let index = 0; index < parts.length; index += 1) {
      const current = parts[index] ?? "";
      const next = parts[index + 1] ?? "";
      if (
        current.includes("(") &&
        !current.includes(")") &&
        next.includes(")")
      ) {
        combined.push(`${current} ${next}`);
        index += 1;
      } else {
        combined.push(current);
      }
    }
    return combined;
  }
  private handleSpaceSeparatorOptimization(
    text: string,
    splits: string[]
  ): string[] | null {
    const trimmed = text.trim();
    if (trimmed.length <= this.chunkSize) {
      const parts = splits
        .map((part) => part.trim())
        .filter((split) => split !== "");
      return RecursiveCharacterTextSplitter.combineParenthesizedPhrases(parts);
    }
    return null;
  }
  private processSplits(
    splits: string[],
    separator: string,
    finalChunks: string[]
  ): void {
    let goodSplits: string[] = [];
    for (const split of splits) {
      if (split.length < this.chunkSize) {
        goodSplits.push(split);
      } else {
        if (goodSplits.length > 0) {
          const mergedText = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        const otherInfo = this.splitText(split);
        finalChunks.push(...otherInfo);
      }
    }
    if (goodSplits.length > 0) {
      const mergedText = this.mergeSplits(goodSplits, separator);
      finalChunks.push(...mergedText);
    }
  }
  public splitText(text: string): string[] {
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error("Cannot have chunkOverlap >= chunkSize");
    }
    const finalChunks: string[] = [];
    const separator = this.findBestSeparator(text);
    // oxlint-disable-next-line typescript/no-misused-spread, no-ternary -- #586: This transformation intentionally iterates Unicode code points; changing to graphemes or UTF-16 units would alter its existing text contract.; no-ternary: Keep splits as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const splits = separator ? text.split(separator) : [...text];
    if (separator === " ") {
      const optimized = this.handleSpaceSeparatorOptimization(text, splits);
      if (optimized) {
        return optimized;
      }
    }
    this.processSplits(splits, separator, finalChunks);
    return finalChunks;
  }
}
/* oxlint-enable import/no-named-export */
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */
