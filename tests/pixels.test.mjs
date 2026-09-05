import test from "node:test";
import assert from "node:assert/strict";
import { gray, decode, rgba } from "../src/dicom_workbench/web/pixels.js";

test("DICOM LINEAR boundaries and midpoint", () => {
  assert.equal(gray(-160, 40, 400), 0);
  assert.equal(gray(239, 40, 400), 255);
  assert.equal(gray(39.5, 40, 400), 128);
});

test("width one is a threshold, not divide-by-zero", () => {
  assert.equal(gray(9.5, 10, 1), 0);
  assert.equal(gray(9.5001, 10, 1), 255);
});

test("MONOCHROME1 inverts the final display value", () => {
  for (const value of [-1000, 0, 40, 1000])
    assert.equal(gray(value, 40, 400, true), 255 - gray(value, 40, 400));
});

test("little-endian signed pixels and modality rescale", () => {
  const raw = new ArrayBuffer(6),
    view = new DataView(raw);
  [-100, 0, 1024].forEach((v, i) => view.setInt16(i * 2, v, true));
  assert.deepEqual(
    [
      ...decode(raw, {
        rows: 1,
        columns: 3,
        signed: true,
        slope: 2,
        intercept: -1024,
      }),
    ],
    [-1224, -1024, 1024],
  );
});

test("unsigned values above 32767 stay positive", () => {
  const raw = new ArrayBuffer(2);
  new DataView(raw).setUint16(0, 65535, true);
  assert.equal(
    decode(raw, {
      rows: 1,
      columns: 1,
      signed: false,
      slope: 1,
      intercept: 0,
    })[0],
    65535,
  );
});

test("RGBA is opaque and does not mutate source pixels", () => {
  const source = new Float64Array([-160, 239]);
  assert.deepEqual(
    [...rgba(source, 40, 400, false)],
    [0, 0, 0, 255, 255, 255, 255, 255],
  );
  assert.deepEqual([...source], [-160, 239]);
});

test("invalid buffers and window settings fail", () => {
  assert.throws(() => decode(new ArrayBuffer(1), { rows: 1, columns: 1 }));
  for (const width of [0, -1, NaN, Infinity])
    assert.throws(() => rgba([0], 40, width, false));
});
