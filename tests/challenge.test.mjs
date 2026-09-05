import test from "node:test";
import assert from "node:assert/strict";
import {
  challenge,
  DEVELOPMENT_SEEDS,
  HELD_OUT_SEEDS,
} from "../src/dicom_workbench/web/challenge.js";
import { scoreChallenge } from "../src/dicom_workbench/web/challenge-score.js";
import {
  erase,
  verifyErase,
} from "../src/dicom_workbench/web/exercise-core.js";
const original = new Uint8ClampedArray(512 * 512 * 4).fill(160);
for (let n = 3; n < original.length; n += 4) original[n] = 255;
const key = (seed) => {
  const s = challenge(original, 512, 512, seed);
  s.dirty = { pixels: s.pixels.slice() };
  return s;
};
test("Reproducible scenarios, fixed split, blank and innocent controls", () => {
  assert(!DEVELOPMENT_SEEDS.some((s) => HELD_OUT_SEEDS.includes(s)));
  for (const seed of [...DEVELOPMENT_SEEDS, ...HELD_OUT_SEEDS]) {
    const a = key(seed),
      b = key(seed);
    assert.deepEqual(a, b);
    assert.deepEqual(a.baseline, original);
  }
  assert.equal(key(0).identifiers.length, 0);
  assert.equal(key(1).identifiers.length, 0);
  assert.equal(
    scoreChallenge(original, key(0)).changed_pixels_outside_labels,
    0,
  );
  for (const seed of [-1, 1.1, NaN, Infinity, 4294967296])
    assert.throws(() => key(seed));
});
test("Independent scorer catches every missed identifier and partial/shifted erasure", () => {
  for (const seed of [2, 3, 4, 5, 7101, 8234]) {
    const s = key(seed);
    assert.equal(scoreChallenge(s.pixels, s).missed_identifiers, 4);
    const partial = erase(s.pixels, 512, 512, [s.labels[0]]);
    assert(scoreChallenge(partial, s).missed_identifiers > 0);
    const clean = erase(s.pixels, 512, 512, s.labels);
    assert.equal(scoreChallenge(clean, s).missed_identifiers, 0);
    const shifted = s.labels.map((b) => ({
      ...b,
      x: Math.min(512 - b.width, b.x + 1),
    }));
    assert.throws(() => verifyErase(s.pixels, clean, 512, 512, shifted));
    clean[512 * 511 * 4 + 3] = 0;
    assert.throws(() => verifyErase(s.pixels, clean, 512, 512, s.labels));
  }
});
test("Erasing everything cannot hide unnecessary damage or innocent text loss", () => {
  const s = key(3),
    blank = erase(s.pixels, 512, 512, [
      { x: 0, y: 0, width: 512, height: 512 },
    ]);
  const score = scoreChallenge(blank, s);
  assert.equal(score.missed_identifiers, 0);
  assert(score.changed_pixels_outside_labels > 250000);
  assert(score.innocent_label_pixels_changed > 0);
});
