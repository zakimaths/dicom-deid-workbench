// Bounded PNG chunk operations for browser-generated RGB/RGBA exercise files.
// https://www.w3.org/TR/png-3/#11textinfo — not a general uploaded-PNG scrubber.
import { equalBytes } from "./exercise-core.js";
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const enc = new TextEncoder(),
  dec = new TextDecoder();
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = table[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
export function chunk(type, data) {
  const out = new Uint8Array(data.length + 12),
    v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(enc.encode(type), 4);
  out.set(data, 8);
  v.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}
export function parsePNG(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length > 24 * 1024 * 1024 ||
    !equalBytes(bytes.subarray(0, 8), signature)
  )
    throw new Error("Invalid exercise PNG signature or size.");
  const result = [];
  let offset = 8,
    idat = false,
    idatEnded = false;
  while (offset < bytes.length) {
    if (result.length >= 4096 || offset + 12 > bytes.length)
      throw new Error("Incomplete exercise PNG.");
    const v = new DataView(bytes.buffer, bytes.byteOffset + offset),
      length = v.getUint32(0),
      end = offset + 12 + length;
    if (end > bytes.length) throw new Error("PNG chunk exceeds the file.");
    const type = dec.decode(bytes.subarray(offset + 4, offset + 8)),
      data = bytes.slice(offset + 8, end - 4);
    if (
      !/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type) ||
      v.getUint32(length + 8) !== crc32(bytes.subarray(offset + 4, end - 4))
    )
      throw new Error("PNG integrity check failed.");
    if (!result.length && type !== "IHDR")
      throw new Error("PNG header is missing.");
    if (type === "IHDR") {
      if (result.length || length !== 13)
        throw new Error("Duplicate or malformed PNG header.");
      const h = new DataView(data.buffer),
        w = h.getUint32(0),
        rows = h.getUint32(4);
      if (
        !w ||
        !rows ||
        w > 1704 ||
        rows > 1704 ||
        data[8] !== 8 ||
        ![2, 6].includes(data[9]) ||
        data[10] ||
        data[11] ||
        data[12]
      )
        throw new Error("Unsupported exercise PNG format.");
    }
    if (type === "IDAT") {
      if (idatEnded) throw new Error("Non-contiguous PNG image data.");
      idat = true;
    } else if (idat) idatEnded = true;
    if (
      type[0] === type[0].toUpperCase() &&
      !["IHDR", "IDAT", "IEND"].includes(type)
    )
      throw new Error("Unsupported critical PNG chunk.");
    result.push({ type, data, bytes: bytes.slice(offset, end) });
    offset = end;
    if (type === "IEND") {
      if (length || !idat || offset !== bytes.length)
        throw new Error("Invalid PNG ending or trailing data.");
      return result;
    }
  }
  throw new Error("PNG ending is missing.");
}
export function readText(bytes) {
  const out = Object.create(null);
  for (const c of parsePNG(bytes))
    if (c.type === "tEXt") {
      const split = c.data.indexOf(0);
      if (split < 1 || split > 79) throw new Error("Invalid PNG text keyword.");
      const key = dec.decode(c.data.subarray(0, split)),
        value = dec.decode(c.data.subarray(split + 1));
      if (Object.hasOwn(out, key))
        throw new Error("Duplicate exercise metadata key.");
      out[key] = value;
    }
  return out;
}
export function withMetadata(png, metadata) {
  const chunks = parsePNG(png),
    text = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (
      !/^[A-Za-z][A-Za-z0-9]{0,78}$/.test(key) ||
      typeof value !== "string" ||
      value.length > 8192 ||
      !/^[\x20-\x7e]*$/.test(value)
    )
      throw new Error("Invalid exercise text.");
    text.push(chunk("tEXt", enc.encode(key + "\0" + value)));
  }
  // Rebuild only essential image chunks and explicitly supplied exercise text.
  return concat([
    signature,
    chunks[0].bytes,
    ...text,
    ...chunks
      .filter((c) => c.type === "IDAT" || c.type === "IEND")
      .map((c) => c.bytes),
  ]);
}
export function imagePayload(bytes) {
  return concat(
    parsePNG(bytes)
      .filter((c) => ["IHDR", "IDAT", "IEND"].includes(c.type))
      .map((c) => c.bytes),
  );
}
export function scrubMetadata(png, source) {
  const before = imagePayload(png),
    out = withMetadata(png, { Source: source });
  if (
    !equalBytes(before, imagePayload(out)) ||
    JSON.stringify({ ...readText(out) }) !== JSON.stringify({ Source: source })
  )
    throw new Error("Metadata scrub verification failed.");
  return out;
}
export function asciiJSON(value) {
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
