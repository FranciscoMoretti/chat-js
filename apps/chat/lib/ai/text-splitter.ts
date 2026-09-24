import { TextSplitter } from "./text-splitter-base";
import type { TextSplitterParams } from "./text-splitter-base";

export interface RecursiveCharacterTextSplitterParams extends TextSplitterParams {
  separators: string[];
}
export class RecursiveCharacterTextSplitter
  extends TextSplitter
  implements RecursiveCharacterTextSplitterParams
{
  separators: string[] = ["\n\n", "\n", ".", ",", ">", "<", " ", ""];
  constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
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
  splitText(text: string): string[] {
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error("Cannot have chunkOverlap >= chunkSize");
    }
    const finalChunks: string[] = [];
    const separator = this.findBestSeparator(text);
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
