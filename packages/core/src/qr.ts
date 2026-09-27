/** QR codes drawn by the renderer itself, so no URL leaves the surface. */
/* ---- QR codes: byte mode, error correction level M, versions 1–10 (up to 213 bytes). ---- */

/** Per version at level M: error-correction codewords per block, then [blocks, data codewords] groups. */
const QR_BLOCKS: [number, [number, number][]][] = [
  [10, [[1, 16]]],
  [16, [[1, 28]]],
  [26, [[1, 44]]],
  [18, [[2, 32]]],
  [24, [[2, 43]]],
  [16, [[4, 27]]],
  [18, [[4, 31]]],
  [22, [[2, 38], [2, 39]]],
  [22, [[3, 36], [2, 37]]],
  [26, [[4, 43], [1, 44]]],
];
const QR_ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsRemainder(data: number[], degree: number): number[] {
  const divisor = new Array<number>(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = gfMul(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = gfMul(root, 2);
  }
  const result = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

const QR_MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** The module grid for a text, or undefined when it is longer than version 10 holds. */
export function qrEncode(text: string): boolean[][] | undefined {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 0;
  let dataCodewords = 0;
  for (let v = 1; v <= 10 && !version; v++) {
    const total = QR_BLOCKS[v - 1][1].reduce((a, [n, len]) => a + n * len, 0);
    if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= total * 8) (version = v), (dataCodewords = total);
  }
  if (!version) return undefined;
  const [ecPerBlock, groups] = QR_BLOCKS[version - 1];

  // Bit stream: mode, count, data, terminator, byte alignment, pad codewords.
  const bits: number[] = [];
  const push = (val: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords * 8;
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, bit) => (a << 1) | bit, 0));

  // Blocks with their error correction, interleaved.
  const blocks: { d: number[]; e: number[] }[] = [];
  let k = 0;
  for (const [count, len] of groups) {
    for (let i = 0; i < count; i++) {
      const d = data.slice(k, k + len);
      blocks.push({ d, e: rsRemainder(d, ecPerBlock) });
      k += len;
    }
  }
  const codewords: number[] = [];
  const longest = Math.max(...blocks.map((bl) => bl.d.length));
  for (let i = 0; i < longest; i++) for (const bl of blocks) if (i < bl.d.length) codewords.push(bl.d[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const bl of blocks) codewords.push(bl.e[i]);

  // The grid, with function patterns marked so data and masks leave them alone.
  const size = version * 4 + 17;
  const grid: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    if (x >= 0 && y >= 0 && x < size && y < size) (grid[y][x] = dark), (isFn[y][x] = true);
  };
  for (let i = 0; i < size; i++) (set(6, i, i % 2 === 0), set(i, 6, i % 2 === 0));
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const positions = QR_ALIGN[version - 1];
  const last = positions.length - 1;
  positions.forEach((px, i) =>
    positions.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const formatBits = (mask: number) => {
    const d = mask; // level M is 00
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((d << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  formatBits(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const v = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((v >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      set(a, c, bit);
      set(c, a, bit);
    }
  }

  // Codewords zigzag upward and downward in two-module columns from the right, skipping the timing column.
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!isFn[y][x] && bi < codewords.length * 8) {
          grid[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1;
          bi++;
        }
      }
    }
  }

  // The mask with the lowest penalty.
  const apply = (mask: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFn[y][x] && QR_MASKS[mask](x, y)) grid[y][x] = !grid[y][x];
  };
  const penalty = () => {
    let p = 0;
    const line = (cells: boolean[]) => {
      let run = 0;
      let prev: boolean | null = null;
      cells.forEach((c, i) => {
        if (c === prev) {
          run++;
          if (run === 5) p += 3;
          else if (run > 5) p += 1;
        } else (prev = c), (run = 1);
        if (i + 7 <= cells.length) {
          const seg = cells.slice(i, i + 7);
          const finderLike = seg[0] && !seg[1] && seg[2] && seg[3] && seg[4] && !seg[5] && seg[6];
          const lightBefore = i >= 4 && cells.slice(i - 4, i).every((c) => !c);
          const lightAfter = i + 11 <= cells.length && cells.slice(i + 7, i + 11).every((c) => !c);
          if (finderLike && (lightBefore || lightAfter)) p += 40;
        }
      });
    };
    for (let i = 0; i < size; i++) (line(grid[i]), line(grid.map((row) => row[i])));
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (grid[y][x] === grid[y][x + 1] && grid[y][x] === grid[y + 1][x] && grid[y][x] === grid[y + 1][x + 1]) p += 3;
    const dark = grid.flat().filter(Boolean).length;
    const total = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  };
  let best = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    formatBits(m);
    apply(m);
    const score = penalty();
    apply(m);
    if (score < bestScore) (bestScore = score), (best = m);
  }
  formatBits(best);
  apply(best);
  return grid;
}
