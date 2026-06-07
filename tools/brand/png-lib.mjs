// Dependency-free PNG decode/crop/encode for the Plaino brand sheet.
// Uses only Node's built-in zlib. Handles 8-bit colour type 2 (RGB) and 6 (RGBA).
// Companion to gen-8bit.mjs — same "no deps, own codec" principle.
import zlib from 'node:zlib';

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Decode a PNG buffer to { width, height, channels, data:Uint8Array(width*height*channels) }
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const start = off + 8;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(start);
      height = buf.readUInt32BE(start + 4);
      bitDepth = buf[start + 8];
      colorType = buf[start + 9];
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(start, start + len));
    } else if (type === 'IEND') {
      break;
    }
    off = start + len + 4; // skip data + CRC
  }
  if (bitDepth !== 8) throw new Error('only 8-bit depth supported, got ' + bitDepth);
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : null;
  if (!channels) throw new Error('unsupported colour type ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos++];
      const a = x >= channels ? data[rowStart + x - channels] : 0;
      const b = y > 0 ? data[prevStart + x] : 0;
      const c = x >= channels && y > 0 ? data[prevStart + x - channels] : 0;
      let val;
      switch (filter) {
        case 0: val = rawByte; break;
        case 1: val = rawByte + a; break;
        case 2: val = rawByte + b; break;
        case 3: val = rawByte + ((a + b) >> 1); break;
        case 4: val = rawByte + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + filter);
      }
      data[rowStart + x] = val & 0xff;
    }
  }
  return { width, height, channels, data };
}

// Crop a region; returns a new image object (same channels)
export function crop(img, left, top, w, h) {
  const { channels, data, width } = img;
  left = Math.max(0, Math.round(left));
  top = Math.max(0, Math.round(top));
  w = Math.min(Math.round(w), img.width - left);
  h = Math.min(Math.round(h), img.height - top);
  const out = new Uint8Array(w * h * channels);
  const srcStride = width * channels;
  const dstStride = w * channels;
  for (let y = 0; y < h; y++) {
    const s = (top + y) * srcStride + left * channels;
    out.set(data.subarray(s, s + dstStride), y * dstStride);
  }
  return { width: w, height: h, channels, data: out };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Encode an image object back to a PNG buffer (filter type 0 on every row)
export function encodePng(img) {
  const { width, height, channels, data } = img;
  const colorType = channels === 4 ? 6 : channels === 1 ? 0 : 2;
  const stride = width * channels;
  const rawLen = height * (stride + 1);
  const raw = Buffer.alloc(rawLen);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    raw[pos++] = 0; // filter: none
    raw.set(data.subarray(y * stride, y * stride + stride), pos);
    pos += stride;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// High-quality box/area-average resize (good for downscaling raster art).
export function areaResize(img, dw, dh) {
  const { width: sw, height: sh, channels: c, data: s } = img;
  const out = new Uint8Array(dw * dh * c);
  for (let y = 0; y < dh; y++) {
    const sy0 = Math.floor((y * sh) / dh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx0 = Math.floor((x * sw) / dw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * sw) / dw));
      const acc = new Array(c).fill(0);
      let n = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          const i = (yy * sw + xx) * c;
          for (let k = 0; k < c; k++) acc[k] += s[i + k];
          n++;
        }
      }
      const di = (y * dw + x) * c;
      for (let k = 0; k < c; k++) out[di + k] = Math.round(acc[k] / n);
    }
  }
  return { width: dw, height: dh, channels: c, data: out };
}

// Nearest-neighbour resize — preserves hard pixel edges (pixel-art upscaling).
export function nearestResize(img, dw, dh) {
  const { width: sw, height: sh, channels: c, data: s } = img;
  const out = new Uint8Array(dw * dh * c);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      const si = (sy * sw + sx) * c;
      const di = (y * dw + x) * c;
      for (let k = 0; k < c; k++) out[di + k] = s[si + k];
    }
  }
  return { width: dw, height: dh, channels: c, data: out };
}

// Paste an RGB image centred onto a solid-colour square canvas of side `side`.
export function padToSquare(img, side, bg = [247, 244, 237]) {
  const c = 3;
  const data = new Uint8Array(side * side * c);
  for (let i = 0; i < side * side; i++) {
    data[i * c] = bg[0];
    data[i * c + 1] = bg[1];
    data[i * c + 2] = bg[2];
  }
  const ox = Math.round((side - img.width) / 2);
  const oy = Math.round((side - img.height) / 2);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const tx = ox + x, ty = oy + y;
      if (tx < 0 || ty < 0 || tx >= side || ty >= side) continue;
      const si = (y * img.width + x) * img.channels;
      const di = (ty * side + tx) * c;
      data[di] = img.data[si];
      data[di + 1] = img.data[si + 1];
      data[di + 2] = img.data[si + 2];
    }
  }
  return { width: side, height: side, channels: c, data };
}

// Average luminance (0=black,255=white) of a region — used to find gutters.
export function regionLuma(img, left, top, w, h) {
  const { channels, data, width } = img;
  let sum = 0, n = 0;
  for (let y = top; y < top + h; y++) {
    for (let x = left; x < left + w; x++) {
      const i = (y * width + x) * channels;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      n++;
    }
  }
  return sum / n;
}
