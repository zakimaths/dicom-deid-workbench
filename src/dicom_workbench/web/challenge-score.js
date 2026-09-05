// Scorer only sees reopened output and an answer key. Never imported by OCR.
import { checkPixels } from "./exercise-core.js";
export function scoreChallenge(actual, key) {
  checkPixels(actual, key.width, key.height);
  const black = (n) =>
    actual[n * 4] === 0 &&
    actual[n * 4 + 1] === 0 &&
    actual[n * 4 + 2] === 0 &&
    actual[n * 4 + 3] === 255;
  const labels = key.identifiers.map((label) => ({
    id: label.id,
    remaining_pixels: label.pixels.reduce(
      (count, n) => count + Number(!black(n)),
      0,
    ),
  }));
  let changedOutside = 0,
    controlDamage = 0;
  for (let n = 0; n < key.width * key.height; n++) {
    const changed = [0, 1, 2, 3].some(
      (c) => actual[n * 4 + c] !== key.dirty.pixels[n * 4 + c],
    );
    if (changed && !key.ink[n]) changedOutside++;
    if (changed && key.controls[n] && !key.ink[n]) controlDamage++;
  }
  const missed = labels.filter((l) => l.remaining_pixels > 0).length;
  return {
    identifier_count: labels.length,
    missed_identifiers: missed,
    identifier_miss_rate: labels.length ? missed / labels.length : null,
    image_failure: missed > 0,
    changed_pixels_outside_labels: changedOutside,
    innocent_label_pixels_changed: controlDamage,
    labels,
    detection_claim:
      "Injected synthetic labels only; not real-world PHI sensitivity",
  };
}
