// Generates PWA PNG icons (rounded charcoal square + amber checkmark) with zero deps:
// pixels are rendered via signed-distance functions and packed into PNG by hand.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [28, 25, 23] // stone-900
const FG = [245, 158, 11] // amber-500

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function render(size, { padded = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  // iOS renders apple-touch-icon edge to edge; maskable/regular icons get inner padding
  const inset = padded ? size * 0.08 : 0
  const rect = size - inset * 2
  const radius = padded ? rect * 0.22 : rect * 0.18
  const stroke = size * 0.055
  const check = [
    [0.30, 0.53, 0.445, 0.665],
    [0.445, 0.665, 0.72, 0.36],
  ].map((seg) => seg.map((v) => inset + v * rect))

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5
      // rounded-rect SDF
      const qx = Math.abs(px - size / 2) - (rect / 2 - radius)
      const qy = Math.abs(py - size / 2) - (rect / 2 - radius)
      const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
      const bgA = clamp01(0.5 - sdf)
      const d = Math.min(...check.map(([ax, ay, bx, by]) => distToSegment(px, py, ax, ay, bx, by)))
      const fgA = clamp01(0.5 - (d - stroke)) * bgA
      const i = (y * size + x) * 4
      rgba[i] = BG[0] * (1 - fgA) + FG[0] * fgA
      rgba[i + 1] = BG[1] * (1 - fgA) + FG[1] * fgA
      rgba[i + 2] = BG[2] * (1 - fgA) + FG[2] * fgA
      rgba[i + 3] = Math.round(bgA * 255)
    }
  }
  return png(size, size, rgba)
}

const outDir = new URL('../packages/web/public/icons/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })
writeFileSync(`${outDir}icon-192.png`, render(192, { padded: true }))
writeFileSync(`${outDir}icon-512.png`, render(512, { padded: true }))
writeFileSync(`${outDir}apple-touch-icon.png`, render(180))
console.log('icons written to packages/web/public/icons/')
