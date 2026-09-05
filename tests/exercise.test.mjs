import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import {
  nonymise,
  erase,
  verifyErase,
  remainingInk,
  equalBytes,
  validateRegions,
  FAKE_DETAILS,
} from "../src/dicom_workbench/web/exercise-core.js";
import {
  chunk,
  parsePNG,
  withMetadata,
  readText,
  scrubMetadata,
  imagePayload,
} from "../src/dicom_workbench/web/exercise-png.js";
const join = (parts) =>
  new Uint8Array(Buffer.concat(parts.map((p) => Buffer.from(p))));
const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function png() {
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, 1);
  new DataView(header.buffer).setUint32(4, 1);
  header[8] = 8;
  header[9] = 6;
  return join([
    sig,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(new Uint8Array([0, 30, 40, 50, 255]))),
    chunk("IEND", new Uint8Array()),
  ]);
}
const original = Uint8ClampedArray.from({ length: 512 * 512 * 4 }, (_, i) =>
  i % 4 === 3 ? 255 : i % 251,
);
test("Fake labels occupy added margins; every original pixel remains exact", () => {
  const s = nonymise(original, 512, 512);
  assert(
    equalBytes(s.pixels.subarray(64 * 512 * 4, (64 + 512) * 512 * 4), original),
  );
  assert(remainingInk(s.pixels, s.ink) > 1000);
  const clean = erase(s.pixels, s.width, s.height, s.labels);
  assert.equal(remainingInk(clean, s.ink), 0);
  assert(equalBytes(clean, s.baseline));
});
test("Partial erasure leaves detectable fake pixels; overlapping regions are verified", () => {
  const s = nonymise(original, 512, 512),
    boxes = [s.labels[0], { x: 0, y: 0, width: 20, height: 10 }];
  const after = erase(s.pixels, s.width, s.height, boxes);
  assert(remainingInk(after, s.ink) > 0);
  assert.equal(
    verifyErase(s.pixels, after, s.width, s.height, boxes).selected_pixels,
    512 * 64,
  );
  after[65 * 512 * 4] ^= 1;
  assert.throws(() => verifyErase(s.pixels, after, s.width, s.height, boxes));
});
test("Invalid selections and alpha-channel failures fail closed", () => {
  for (const boxes of [
    [],
    [{ x: -1, y: 0, width: 1, height: 1 }],
    [{ x: 0, y: 0, width: 1.5, height: 1 }],
    [{ x: 511, y: 0, width: 2, height: 1 }],
    Array(33).fill({ x: 0, y: 0, width: 1, height: 1 }),
  ])
    assert.throws(() => validateRegions(boxes, 512, 512));
  const boxes = [{ x: 0, y: 0, width: 1, height: 1 }],
    after = erase(original, 512, 512, boxes);
  after[3] = 0;
  assert.throws(() => verifyErase(original, after, 512, 512, boxes));
});
test("Metadata is physically embedded then removed without touching encoded image bytes", () => {
  const dirty = withMetadata(png(), { Source: "credit", ...FAKE_DETAILS });
  assert.equal(readText(dirty).PatientName, FAKE_DETAILS.PatientName);
  const clean = scrubMetadata(dirty, "credit");
  assert.deepEqual({ ...readText(clean) }, { Source: "credit" });
  assert(equalBytes(imagePayload(dirty), imagePayload(clean)));
  assert(!Buffer.from(clean).includes(Buffer.from("FAKE")));
});
test("Scrub strips alternate text, EXIF and unknown ancillary chunks", () => {
  const parts = parsePNG(png());
  const extra = ["iTXt", "zTXt", "eXIf", "aaAa"].map((t) =>
    chunk(t, new TextEncoder().encode("FAKE hidden")),
  );
  const dirty = join([
    sig,
    parts[0].bytes,
    ...extra,
    ...parts.slice(1).map((c) => c.bytes),
  ]);
  const clean = scrubMetadata(dirty, "credit");
  assert.deepEqual(
    parsePNG(clean).map((c) => c.type),
    ["IHDR", "tEXt", "IDAT", "IEND"],
  );
  assert(!Buffer.from(clean).includes(Buffer.from("FAKE")));
});
test("Corruption, truncation, duplicate fields and trailing hidden bytes are rejected", () => {
  const p = png(),
    bad = p.slice();
  bad[bad.length - 1] ^= 1;
  for (const b of [bad, p.slice(0, -1), join([p, new Uint8Array([0])])])
    assert.throws(() => parsePNG(b));
  const parts = parsePNG(p),
    text = chunk("tEXt", new TextEncoder().encode("PatientName\0FAKE"));
  assert.throws(() =>
    readText(
      join([
        sig,
        parts[0].bytes,
        text,
        text,
        ...parts.slice(1).map((c) => c.bytes),
      ]),
    ),
  );
});
