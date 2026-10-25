/** Read npm pack's package manifest without extracting application files to disk. */
export const archiveManifest = (content: Uint8Array): unknown => {
  const archive = Bun.gunzipSync(new Uint8Array(content));
  const blockSize = 512;
  const decoder = new TextDecoder();
  for (let offset = 0; offset + blockSize <= archive.length;) {
    const header = archive.subarray(offset, offset + blockSize);
    const text = (start: number, length: number): string =>
      decoder.decode(header.subarray(start, start + length)).split("\0")[0];
    const name = text(0, 100);
    if (name === "") {
      break;
    }
    const encodedSize = text(124, 12).trim();
    if (!/^[0-7]+$/u.test(encodedSize)) {
      throw new Error("Invalid package archive size");
    }
    const size = Number.parseInt(encodedSize, 8);
    const start = offset + blockSize;
    if (start + size > archive.length) {
      throw new Error("Truncated package archive");
    }
    if (name === "package/package.json" || name === "./package/package.json") {
      return JSON.parse(decoder.decode(archive.subarray(start, start + size)));
    }
    offset = start + Math.ceil(size / blockSize) * blockSize;
  }
  throw new Error("Package archive is missing package/package.json");
};
