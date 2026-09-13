interface TextSplitterParams {
  chunkOverlap: number;
  chunkSize: number;
}
abstract class TextSplitter implements TextSplitterParams {
  chunkSize = 1000;
  chunkOverlap = 200;
  constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? this.chunkSize;
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap;
  }
  abstract splitText(text: string): string[];
  createDocuments(texts: string[]): string[] {
    const documents: string[] = [];
    for (const text of texts) {
      if (text === null || text === undefined) {
        continue;
      }
      for (const chunk of this.splitText(text)) {
        documents.push(chunk);
      }
    }
    return documents;
  }
  splitDocuments(documents: string[]): string[] {
    return this.createDocuments(documents);
  }
  private static joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim();
    return text === "" ? null : text;
  }
  private static addCurrentDocToResults({
    docs,
    currentDoc,
    separator,
  }: {
    docs: string[];
    currentDoc: string[];
    separator: string;
  }): void {
    const doc = TextSplitter.joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }
  }
  private trimCurrentDocForOverlap({
    currentDoc,
    overlapLimit,
    total,
    nextLength,
  }: {
    currentDoc: string[];
    overlapLimit: number;
    total: number;
    nextLength: number;
  }): number {
    let updatedTotal = total;
    while (
      updatedTotal > overlapLimit ||
      (updatedTotal + nextLength > this.chunkSize && updatedTotal > 0)
    ) {
      updatedTotal -= currentDoc[0]?.length ?? 0;
      currentDoc.shift();
    }
    return updatedTotal;
  }
  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;
    const overlapLimit = separator === "" ? 0 : this.chunkOverlap;
    for (const d of splits) {
      const _len = d.length;
      if (total + _len > this.chunkSize) {
        if (total > this.chunkSize) {
          console.warn(
            `Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`
          );
        }
        if (currentDoc.length > 0) {
          TextSplitter.addCurrentDocToResults({ currentDoc, docs, separator });
          total = this.trimCurrentDocForOverlap({
            currentDoc,
            nextLength: _len,
            overlapLimit,
            total,
          });
        }
      }
      currentDoc.push(d);
      total += _len;
    }
    TextSplitter.addCurrentDocToResults({ currentDoc, docs, separator });
    return docs;
  }
}
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
    const splits = separator ? text.split(separator) : text.split("");
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
