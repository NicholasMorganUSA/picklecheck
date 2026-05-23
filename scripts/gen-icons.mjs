// Generates public/icon-192.png and icon-512.png from the PickleCheck mark,
// with zero dependencies (uses Node's built-in zlib). Run: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x08, 0x08, 0x0c];   // app dark
const LIME = [0xc5, 0xe5, 0x00]; // brand neon
// Pickleball holes, in the 512x512 design space.
const HOLES = [[180, 200], [256, 180], [332, 200], [200, 270], [280, 290], [332, 316], [220, 340]];

// CRC32 (PNG chunks need it).
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function render(size) {
  const s = size / 512;
  const cx = 256 * s, cy = 256 * s, r = 156 * s, hr = 14 * s;
  const holes = HOLES.map(([x, y]) => [x * s, y * s]);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // row filter: none
    for (let x = 0; x < size; x++) {
      let col = BG;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) {
        col = LIME;
        for (const [hx, hy] of holes) {
          const ex = x + 0.5 - hx, ey = y + 0.5 - hy;
          if (ex * ex + ey * ey <= hr * hr) { col = BG; break; }
        }
      }
      raw[p++] = col[0]; raw[p++] = col[1]; raw[p++] = col[2]; raw[p++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, render(size));
  console.log(`wrote public/icon-${size}.png`);
}
