import { colors } from "./identity";

const positions = [
  [0, 0],
  [120, 0],
  [240, 0],
  [0, 120],
  [0, 240],
  [120, 240],
  [240, 240],
] as const;

const capabilityPatterns: Record<string, number> = {
  Chat: 0,
  "Chat UI": 0,
  "Chat history": 1,
  Runtime: 3,
  "EVE runtime": 3,
  Auth: 2,
  Authentication: 2,
  Projects: 4,
  "File uploads": 5,
  Storage: 5,
  MCP: 6,
  Sharing: 0,
  "Retrieve URL": 2,
  Gateway: 1,
  Tools: 4,
  Plugins: 6,
};

const escapeText = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The approved Carbon / Focus field, sampled continuously across the C. */
export const wavePaths = (index: number, phase = 0.3): string => {
  const [offsetX, offsetY] = positions[((index % 7) + 7) % 7];
  const time = phase * Math.PI * 2;
  let paths = "";
  for (let line = -70; line < 450; line += 6) {
    let path = "";
    for (let x = 0; x <= 108; x += 4) {
      const globalX = x + offsetX;
      const y =
        line +
        22 * Math.sin(globalX * 0.019 + line * 0.014 + time) +
        7 * Math.cos(globalX * 0.035 - line * 0.008 - time);
      path += `${x ? "L" : "M"}${x} ${(y - offsetY).toFixed(2)}`;
    }
    paths += `<path d="${path}" opacity="${line % 3 === 0 ? 0.9 : 0.55}"/>`;
  }
  return paths;
};

/** id must be unique when several SVGs are inserted inline in the same document. */
export const squareSvg = (
  name: string,
  meta: string,
  index: number,
  id: string
): string => {
  const field = wavePaths(capabilityPatterns[name] ?? index);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none" class="carbon-square" aria-hidden="true"><defs><linearGradient id="${escapeText(id)}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset=".3" stop-color="${colors.shade}" stop-opacity="0"/><stop offset=".8" stop-color="${colors.shade}"/></linearGradient></defs><rect class="square-surface" width="160" height="160" fill="${colors.surface}"/><g class="square-field" style="color:${colors.pattern};opacity:.7"><svg width="160" height="160" viewBox="0 0 108 108" fill="none" stroke="currentColor" stroke-width=".85" overflow="hidden">${field}</svg></g><rect class="square-shade" width="160" height="160" fill="url(#${escapeText(id)})"/><text class="square-meta" x="13" y="112" style="font:8px Plex,monospace;letter-spacing:.7px;fill:${colors.muted}">${escapeText(meta.toUpperCase())}</text><text class="square-name" x="13" y="138" style="font:470 14px Geist,Arial,sans-serif;letter-spacing:-.25px;fill:${colors.foreground}">${escapeText(name)}</text></svg>`;
};
