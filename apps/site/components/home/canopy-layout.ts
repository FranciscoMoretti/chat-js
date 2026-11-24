export interface FieldSize {
  width: number;
  height: number;
}

export interface FieldPosition {
  column: number;
  row: number;
}

const modulo = (value: number, length: number) =>
  ((value % length) + length) % length;

// Put four complete tiles across a phone, six across a tablet and eight
// across a typical laptop. Keep a gutter between adjacent tiles when panning.
const preferredColumns = (width: number) => {
  if (width < 540) {
    return 4;
  }
  return Math.min(12, Math.max(5, Math.round(width / 144)));
};

export const canopyLayout = ({ width, height }: FieldSize, count: number) => {
  let columns = preferredColumns(width);
  // A dragged viewport may include a partial tile at both ends of each axis.
  // Reserve that extra row and column so no capability appears twice.
  while (
    columns > 1 &&
    (columns + 1) * (Math.ceil((height * columns) / width) + 1) > count
  ) {
    columns -= 1;
  }
  const pitch = width / columns;
  const side = Math.round(pitch * 0.91);
  const stride = columns + 1;
  const rows = Math.ceil(height / pitch);
  const period = Math.max(count, stride * (rows + 1));
  const slots = new Map<number, number>();
  const slotAt = (column: number, row: number) =>
    modulo(row * stride + column, period);
  const centerFirst = Array.from(
    { length: columns },
    (_, column) => column
  ).toSorted(
    (a, b) => Math.abs(a + 0.5 - columns / 2) - Math.abs(b + 0.5 - columns / 2)
  );
  // Row zero is pinned to the bottom, underneath the headline's gradient.
  // The most recognizable blocks get complete cells here even on a short phone.
  for (let row = 0; row > -rows; row -= 1) {
    for (const column of centerFirst) {
      slots.set(slotAt(column, row), slots.size);
    }
  }
  for (let slot = 0; slot < period; slot += 1) {
    if (!slots.has(slot)) {
      slots.set(slot, slots.size);
    }
  }
  return { columns, pitch, side, slots, slotAt };
};

export const visibleCanopyCells = (
  { width, height }: FieldSize,
  layout: ReturnType<typeof canopyLayout>,
  camera: FieldPosition
) => {
  const { pitch, side } = layout;
  const inset = (pitch - side) / 2;
  const firstColumn = Math.floor(camera.column);
  const firstRow = Math.floor(camera.row - height / pitch) + 1;
  const lastColumn = Math.ceil(camera.column + width / pitch) - 1;
  const lastRow = Math.ceil(camera.row);
  const result = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const left = (column - camera.column) * pitch + inset;
      const top = height + (row - camera.row - 1) * pitch + inset;
      if (
        left >= width ||
        top >= height ||
        left + side <= 0 ||
        top + side <= 0
      ) {
        continue;
      }
      const index = layout.slots.get(layout.slotAt(column, row));
      if (index !== undefined) {
        result.push({ row, column, left, top, index });
      }
    }
  }
  return result;
};
