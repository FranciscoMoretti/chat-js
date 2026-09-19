export interface TextSplitterParams {
  chunkOverlap: number;
  chunkSize: number;
}
export abstract class TextSplitter implements TextSplitterParams {
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
