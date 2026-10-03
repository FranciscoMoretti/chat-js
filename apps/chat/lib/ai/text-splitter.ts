import { TextSplitter } from "./text-splitter-base";
import type { TextSplitterParams } from "./text-splitter-base";

export interface RecursiveCharacterTextSplitterParams extends TextSplitterParams {
  separators: string[];
}
/* oxlint-disable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * id-length (#506): RecursiveCharacterTextSplitter uses s; i as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/no-named-export (#527): Preserve the named RecursiveCharacterTextSplitter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-statements (#512): RecursiveCharacterTextSplitter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): RecursiveCharacterTextSplitter uses -1, 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): RecursiveCharacterTextSplitter derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-optional-chaining (#542): RecursiveCharacterTextSplitter handles optional fields?.separators without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
    this.separators = fields?.separators ?? this.separators;
  }
  private findBestSeparator(text: string): string {
    for (const s of this.separators) {
      if (s === "" || text.includes(s)) {
        return s;
      }
    }
    return this.separators.at(-1) ?? "";
  }
  private static combineParenthesizedPhrases(parts: string[]): string[] {
    const combined: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const current = parts[i] ?? "";
      const next = parts[i + 1] ?? "";
      if (
        current.includes("(") &&
        !current.includes(")") &&
        next.includes(")")
      ) {
        combined.push(`${current} ${next}`);
        i += 1;
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
      const parts = splits.map((s) => s.trim()).filter((s) => s !== "");
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
    for (const s of splits) {
      if (s.length < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length > 0) {
          const mergedText = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        const otherInfo = this.splitText(s);
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
    // oxlint-disable-next-line typescript/no-misused-spread -- #586: This transformation intentionally iterates Unicode code points; changing to graphemes or UTF-16 units would alter its existing text contract.
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
/* oxlint-enable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */
