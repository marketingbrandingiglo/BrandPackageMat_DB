/**
 * Menulis ulang tabel `name` (dan penanda bold di OS/2/head) file TrueType statis, supaya nama
 * family/style sesuai katalog. Dibutuhkan karena hasil instancing variable font (harfbuzz)
 * mewarisi nama instance default, mis. "Montserrat Thin" untuk file Bold. Nama yang benar
 * dipakai resvg untuk mencocokkan font-family dan muncul di PDF (dibuka di Illustrator).
 */

interface Table {
  tag: string;
  data: Buffer;
}

function readTables(font: Buffer): Table[] {
  const n = font.readUInt16BE(4);
  const out: Table[] = [];
  for (let i = 0; i < n; i++) {
    const p = 12 + i * 16;
    const tag = font.toString("latin1", p, p + 4);
    const off = font.readUInt32BE(p + 8);
    const len = font.readUInt32BE(p + 12);
    out.push({ tag, data: Buffer.from(font.subarray(off, off + len)) });
  }
  return out;
}

function checksum(b: Buffer): number {
  let sum = 0;
  const padded = b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

function writeFont(tables: Table[], sfntVersion: number): Buffer {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const n = sorted.length;
  let pow = 1;
  while (pow * 2 <= n) pow *= 2;
  const header = Buffer.alloc(12 + n * 16);
  header.writeUInt32BE(sfntVersion, 0);
  header.writeUInt16BE(n, 4);
  header.writeUInt16BE(pow * 16, 6);
  header.writeUInt16BE(Math.log2(pow), 8);
  header.writeUInt16BE(n * 16 - pow * 16, 10);
  const bodies: Buffer[] = [];
  let offset = header.length;
  sorted.forEach((t, i) => {
    if (t.tag === "head") t.data.writeUInt32BE(0, 8);
    const p = 12 + i * 16;
    header.write(t.tag, p, "latin1");
    header.writeUInt32BE(checksum(t.data), p + 4);
    header.writeUInt32BE(offset, p + 8);
    header.writeUInt32BE(t.data.length, p + 12);
    const pad = (4 - (t.data.length % 4)) % 4;
    bodies.push(t.data, Buffer.alloc(pad));
    offset += t.data.length + pad;
  });
  const font = Buffer.concat([header, ...bodies]);
  const head = sorted.findIndex((t) => t.tag === "head");
  if (head >= 0) {
    const headOff = header.readUInt32BE(12 + head * 16 + 8);
    font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOff + 8);
  }
  return font;
}

/** Ambil record nama Windows (3,1,0x409) yang dipertahankan, mis. copyright dan lisensi. */
function oldNames(name: Buffer): Map<number, string> {
  const out = new Map<number, string>();
  const count = name.readUInt16BE(2);
  const strOff = name.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const p = 6 + i * 12;
    const [pid, eid, lid, nid, len, off] = [0, 2, 4, 6, 8, 10].map((x) => name.readUInt16BE(p + x));
    if (pid !== 3 || eid !== 1 || lid !== 0x409) continue;
    const raw = name.subarray(strOff + off, strOff + off + len);
    let s = "";
    for (let j = 0; j + 1 < raw.length; j += 2) s += String.fromCharCode(raw.readUInt16BE(j));
    out.set(nid, s);
  }
  return out;
}

function buildName(records: Map<number, string>): Buffer {
  const ids = [...records.keys()].sort((a, b) => a - b);
  const strings = ids.map((id) => {
    const s = records.get(id)!;
    const b = Buffer.alloc(s.length * 2);
    for (let i = 0; i < s.length; i++) b.writeUInt16BE(s.charCodeAt(i), i * 2);
    return b;
  });
  const head = Buffer.alloc(6 + ids.length * 12);
  head.writeUInt16BE(0, 0);
  head.writeUInt16BE(ids.length, 2);
  head.writeUInt16BE(head.length, 4);
  let off = 0;
  ids.forEach((id, i) => {
    const p = 6 + i * 12;
    head.writeUInt16BE(3, p);
    head.writeUInt16BE(1, p + 2);
    head.writeUInt16BE(0x409, p + 4);
    head.writeUInt16BE(id, p + 6);
    head.writeUInt16BE(strings[i].length, p + 8);
    head.writeUInt16BE(off, p + 10);
    off += strings[i].length;
  });
  return Buffer.concat([head, ...strings]);
}

/** Pertahankan copyright, merek dagang, pembuat, deskripsi, URL, dan lisensi (ID 0, 7-14). */
const KEEP = [0, 5, 7, 8, 9, 10, 11, 12, 13, 14];

export function setFontNames(font: Buffer, family: string, style: "Regular" | "Bold"): Buffer {
  const tables = readTables(font);
  const name = tables.find((t) => t.tag === "name");
  const old = name ? oldNames(name.data) : new Map<number, string>();
  const ps = `${family.replace(/[^A-Za-z0-9]/g, "")}-${style}`;
  const rec = new Map<number, string>();
  for (const id of KEEP) if (old.has(id)) rec.set(id, old.get(id)!);
  rec.set(1, family);
  rec.set(2, style);
  rec.set(3, `${ps};BPA`);
  rec.set(4, style === "Regular" ? family : `${family} Bold`);
  rec.set(6, ps);
  const nameData = buildName(rec);
  if (name) name.data = nameData;
  else tables.push({ tag: "name", data: nameData });

  const bold = style === "Bold";
  const os2 = tables.find((t) => t.tag === "OS/2");
  if (os2) {
    os2.data.writeUInt16BE(bold ? 700 : 400, 4);
    // fsSelection: bit0 italic, bit5 bold, bit6 regular.
    let fs = os2.data.readUInt16BE(62) & ~(1 | (1 << 5) | (1 << 6));
    fs |= bold ? 1 << 5 : 1 << 6;
    os2.data.writeUInt16BE(fs, 62);
  }
  const head = tables.find((t) => t.tag === "head");
  if (head) head.data.writeUInt16BE((head.data.readUInt16BE(44) & ~3) | (bold ? 1 : 0), 44);
  // Tabel variasi sisa tidak lagi relevan untuk font statis.
  return writeFont(
    tables.filter((t) => !["STAT", "fvar", "gvar", "avar", "HVAR", "MVAR", "VVAR", "cvar"].includes(t.tag)),
    font.readUInt32BE(0),
  );
}
