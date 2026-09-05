// Deterministic pixel generator. No browser fonts, random clock or detector access.
import { glyphs, checkPixels } from "./exercise-core.js";
export const GENERATOR_VERSION = "challenge-1";
export const DEVELOPMENT_SEEDS = Object.freeze([11, 22, 33, 44, 55, 66]);
export const HELD_OUT_SEEDS = Object.freeze([
  7101, 8234, 9345, 10456, 11567, 12678,
]);
export function challenge(original, width, height, seed) {
  checkPixels(original, width, height);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295)
    throw new Error("Use a whole-number seed from 0 to 4294967295.");
  let rng = seed >>> 0;
  const random = (n) => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng % n;
  };
  const pixels = original.slice(),
    ink = new Uint8Array(width * height),
    controls = new Uint8Array(width * height),
    identifiers = [],
    labels = [];
  const scenario = seed % 6;
  // Type 0 has no injected text, type 1 only an innocent orientation marker.
  const values =
    scenario < 2
      ? []
      : [
          `FAKE ${["ALEX", "SAM", "JO", "LEE"][random(4)]} ${100 + random(900)}`,
          `FAKE ID ${10000 + random(90000)}`,
          `FAKE DOB ${1970 + random(40)}-01-02`,
          `FAKE SITE ${10 + random(90)}`,
        ];
  function stamp(value, index, sensitive) {
    const scale = 1 + random(2),
      bold = random(2),
      slant = random(3) - 1;
    const wide = value.length * 6 * scale + 8,
      high = 7 * scale + 4;
    const rotated = scenario === 4 && index % 2 === 0;
    const bw = rotated ? high : wide,
      bh = rotated ? wide : high;
    if (bw > width || bh > height)
      throw new Error("The challenge labels do not fit this picture.");
    let left = random(width - bw + 1),
      top = Math.floor(((index + 1) * height) / 6);
    if (scenario === 2) {
      left = index % 2 ? width - bw : 0;
      top = index % 2 ? height - bh : index * 30;
    }
    top = Math.min(top, height - bh);
    const shade = [48, 96, 190, 255][random(4)],
      rgb = random(2) ? [shade, shade, shade] : [shade, 200, 80];
    const indices = new Set();
    [...value].forEach((char, col) =>
      glyphs[char].forEach((bits, row) => {
        for (let x = 0; x < 5; x++)
          if (bits & (1 << (4 - x)))
            for (let sy = 0; sy < scale; sy++)
              for (let sx = 0; sx < scale + bold; sx++) {
                let px =
                    col * 6 * scale +
                    x * scale +
                    sx +
                    3 +
                    Math.round((slant * row) / 3),
                  py = row * scale + sy + 2;
                if (rotated) [px, py] = [high - 1 - py, px];
                const xx = left + px,
                  yy = top + py;
                if (xx < 0 || xx >= width || yy < 0 || yy >= height)
                  throw new Error("A challenge label was clipped.");
                const n = yy * width + xx;
                pixels.set([...rgb, 255], n * 4);
                indices.add(n);
                (sensitive ? ink : controls)[n] = 1;
              }
      }),
    );
    const xs = [...indices].map((n) => n % width),
      ys = [...indices].map((n) => Math.floor(n / width));
    const box = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs) + 1,
      height: Math.max(...ys) - Math.min(...ys) + 1,
    };
    if (sensitive) {
      identifiers.push({ id: `label-${index + 1}`, pixels: [...indices] });
      labels.push(box);
    }
  }
  values.forEach((v, i) => stamp(v, i, true));
  if (scenario !== 0) stamp("L", 4, false);
  return {
    pixels,
    baseline: original.slice(),
    ink,
    controls,
    identifiers,
    labels,
    width,
    height,
    seed,
    generator: GENERATOR_VERSION,
    scenario,
    challenge: true,
    fakeDetails: {
      PatientName: `FAKE^PERSON^${seed}`,
      PatientID: `FAKE-${seed}`,
      PatientBirthDate: "20000102 (FAKE)",
      InstitutionName: "FAKE TRAINING SITE",
      StudyDate: "20000103 (FAKE)",
      ReferringPhysicianName: "FAKE^DOCTOR",
      Comment: "SYNTHETIC IDENTIFIERS FOR TEACHING ONLY",
    },
  };
}
