// Independent test decoder: Node zlib plus PNG scanline reconstruction.
// Does not import any production PNG or pixel logic.
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
export function decodePNG(bytes) {
  const b = Buffer.from(bytes);
  assert.equal(b.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  let at = 8,
    width,
    height,
    channels;
  const payload = [],
    text = {};
  while (at < b.length) {
    const n = b.readUInt32BE(at),
      type = b.toString("ascii", at + 4, at + 8),
      data = b.subarray(at + 8, at + 8 + n);
    assert.equal(data.length, n);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8);
      assert([2, 6].includes(data[9]));
      channels = data[9] === 6 ? 4 : 3;
      assert.equal(data[12], 0);
    }
    if (type === "IDAT") payload.push(data);
    if (type === "tEXt") {
      const split = data.indexOf(0);
      text[data.toString("latin1", 0, split)] = data.toString(
        "latin1",
        split + 1,
      );
    }
    at += n + 12;
    if (type === "IEND") break;
  }
  assert.equal(at, b.length);
  const raw = inflateSync(Buffer.concat(payload)),
    stride = width * channels,
    out = Buffer.alloc(width * height * 4);
  assert.equal(raw.length, (stride + 1) * height);
  let prior = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      row = Buffer.alloc(stride);
    assert(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0,
        bb = prior[x],
        c = x >= channels ? prior[x - channels] : 0,
        p = a + bb - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - bb),
        pc = Math.abs(p - c);
      const prediction = [
        0,
        a,
        bb,
        Math.floor((a + bb) / 2),
        pa <= pb && pa <= pc ? a : pb <= pc ? bb : c,
      ][filter];
      row[x] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
    for (let x = 0; x < width; x++) {
      const n = (y * width + x) * 4;
      out[n] = row[x * channels];
      out[n + 1] = row[x * channels + 1];
      out[n + 2] = row[x * channels + 2];
      out[n + 3] = channels === 4 ? row[x * channels + 3] : 255;
    }
    prior = row;
  }
  return { width, height, pixels: out, text };
}
