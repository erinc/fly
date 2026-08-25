export const MAGIC = "FLYR";
export const FLAG_SEASONAL = 1;
export const FLAG_CHARTER = 2;
export const HEADER_BYTES = 8;

export type RouteRecord = { a: number; b: number; minutes: number; flags: number };

export type RouteTable = {
  count: number;
  a: Uint16Array;
  b: Uint16Array;
  minutes: Uint16Array;
  flags: Uint8Array;
};

/**
 * Encodes route records into the FLYR binary format.
 *
 * Layout (spec §4.4): 4-byte magic "FLYR", Uint32 count (LE), then
 * contiguous a[]/b[]/minutes[] Uint16 arrays and a flags[] Uint8 array.
 * Arrays are stored contiguously (not interleaved) so each maps directly
 * onto a typed array without per-record DataView reads, and the 8-byte
 * header keeps every Uint16Array 2-byte aligned.
 */
export function encodeRoutes(routes: RouteRecord[]): ArrayBuffer {
  const n = routes.length;
  const buf = new ArrayBuffer(HEADER_BYTES + n * 7);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < 4; i++) bytes[i] = MAGIC.charCodeAt(i);
  new DataView(buf).setUint32(4, n, true);

  const a = new Uint16Array(buf, HEADER_BYTES, n);
  const b = new Uint16Array(buf, HEADER_BYTES + n * 2, n);
  const minutes = new Uint16Array(buf, HEADER_BYTES + n * 4, n);
  const flags = new Uint8Array(buf, HEADER_BYTES + n * 6, n);

  for (let i = 0; i < n; i++) {
    const r = routes[i]!;
    a[i] = r.a;
    b[i] = r.b;
    minutes[i] = r.minutes;
    flags[i] = r.flags;
  }
  return buf;
}

export function decodeRoutes(buf: ArrayBuffer): RouteTable {
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) throw new Error("bad magic in routes.bin");
  }
  const count = new DataView(buf).getUint32(4, true);
  return {
    count,
    a: new Uint16Array(buf, HEADER_BYTES, count),
    b: new Uint16Array(buf, HEADER_BYTES + count * 2, count),
    minutes: new Uint16Array(buf, HEADER_BYTES + count * 4, count),
    flags: new Uint8Array(buf, HEADER_BYTES + count * 6, count),
  };
}
