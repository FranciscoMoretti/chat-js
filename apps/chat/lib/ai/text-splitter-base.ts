/* oxlint-disable import/no-named-export -- Keep the named type bindings (TextSplitterParams); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export interface TextSplitterParams {
  chunkOverlap: number;
  chunkSize: number;
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (TextSplitter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-statements, no-console, no-continue, no-magic-numbers, no-undefined, no-underscore-dangle, unicorn/no-null --
 * max-statements (#512): TextSplitter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): TextSplitter emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): TextSplitter skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): TextSplitter uses 1000, 200, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): TextSplitter uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * no-underscore-dangle (#520): TextSplitter accesses the established _len field convention; renaming requires changing the owning SDK or backing-field contract.
 * unicorn/no-null (#570): TextSplitter preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export abstract class TextSplitter implements TextSplitterParams {
  public chunkSize = 1000;
  public chunkOverlap = 200;
  public constructor(fields?: Readonly<Partial<TextSplitterParams>>) {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Constructor fields is an optional public argument; the no-options constructor retains each established default, so direct access is not equivalent. The app guidance prefers optional chaining.
    this.chunkSize = fields?.chunkSize ?? this.chunkSize;
    // oxlint-disable-next-line oxc/no-optional-chaining -- Constructor fields is an optional public argument; the no-options constructor retains each established default, so direct access is not equivalent. The app guidance prefers optional chaining.
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap;
  }
  public abstract splitText(text: string): string[];
  public createDocuments(texts: readonly string[]): string[] {
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
  public splitDocuments(documents: readonly string[]): string[] {
    return this.createDocuments(documents);
  }
  private static joinDocs(
    docs: readonly string[],
    separator: string
  ): string | null {
    const text = docs.join(separator).trim();

    if (text === "") {
      return null;
    }
    return text;
  }
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- addCurrentDocToResults appends to its docs output; trimCurrentDocForOverlap shifts the active currentDoc window. */
  private static addCurrentDocToResults({
    docs,
    currentDoc,
    separator,
  }: Readonly<{
    docs: string[];
    currentDoc: readonly string[];
    separator: string;
  }>): void {
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
  }: Readonly<{
    currentDoc: string[];
    overlapLimit: number;
    total: number;
    nextLength: number;
  }>): number {
    let updatedTotal = total;
    while (
      updatedTotal > overlapLimit ||
      (updatedTotal + nextLength > this.chunkSize && updatedTotal > 0)
    ) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- currentDoc[0] is an array read after repeated shift(); indexing is not a presence guarantee. Preserve zero-length fallback rather than rely solely on string[] inference or private-method callers. The app guidance prefers optional chaining.
      updatedTotal -= currentDoc[0]?.length ?? 0;
      currentDoc.shift();
    }
    return updatedTotal;
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
  public mergeSplits(splits: readonly string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;
    // oxlint-disable-next-line no-ternary -- Keep overlapLimit as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const overlapLimit = separator === "" ? 0 : this.chunkOverlap;
    for (const split of splits) {
      const _len = split.length;
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
      currentDoc.push(split);
      total += _len;
    }
    TextSplitter.addCurrentDocToResults({ currentDoc, docs, separator });
    return docs;
  }
}
/* oxlint-enable import/no-named-export */
/* oxlint-enable max-statements, no-console, no-continue, no-magic-numbers, no-undefined, no-underscore-dangle, unicorn/no-null */
