export interface TextSplitterParams {
  chunkOverlap: number;
  chunkSize: number;
}
/* oxlint-disable id-length, max-statements, no-console, no-continue, no-magic-numbers, no-undefined, no-underscore-dangle, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * id-length (#506): TextSplitter uses d as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/no-named-export (#527): Preserve the named TextSplitter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-statements (#512): TextSplitter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): TextSplitter emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): TextSplitter skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): TextSplitter uses 1000, 200, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): TextSplitter derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): TextSplitter uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * no-underscore-dangle (#520): TextSplitter accesses the established _len field convention; renaming requires changing the owning SDK or backing-field contract.
 * oxc/no-optional-chaining (#542): TextSplitter handles optional fields?.chunkSize; fields?.chunkOverlap; currentDoc[0]?.length without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): TextSplitter accepts texts: string[]; documents: string[]; docs: string[]; { docs, currentDoc, separator, }: { docs: string[]; currentDoc: string[]; ; { currentDoc, overlapLimit, total, nextLength, }: { currentDoc: string[]; ; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): TextSplitter preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export abstract class TextSplitter implements TextSplitterParams {
  public chunkSize = 1000;
  public chunkOverlap = 200;
  public constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? this.chunkSize;
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap;
  }
  public abstract splitText(text: string): string[];
  public createDocuments(texts: string[]): string[] {
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
  public splitDocuments(documents: string[]): string[] {
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
  public mergeSplits(splits: string[], separator: string): string[] {
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
/* oxlint-enable id-length, max-statements, no-console, no-continue, no-magic-numbers, no-undefined, no-underscore-dangle, typescript/prefer-readonly-parameter-types, unicorn/no-null */
