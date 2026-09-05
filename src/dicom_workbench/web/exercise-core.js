// Pure operations for the known teaching exercise, not a general image anonymiser.
export const FAKE_DETAILS = Object.freeze({
  PatientName: "FAKE^ALEX^EXAMPLE",
  PatientID: "FAKE-TRAINING-0001",
  PatientBirthDate: "20000101 (FAKE)",
  InstitutionName: "FAKE EXAMPLE HOSPITAL",
  StudyDate: "20000102 (FAKE)",
  ReferringPhysicianName: "FAKE^DOCTOR^EXAMPLE",
  Comment: "SYNTHETIC IDENTIFIERS FOR TEACHING ONLY",
});
export const HEADER = 64,
  FOOTER = 40;
export const glyphs = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  J: [7, 2, 2, 2, 18, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 25, 21, 19, 19, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14],
  1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31],
  3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 16, 30, 1, 1, 30],
  6: [14, 16, 16, 30, 17, 17, 14],
  7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 1, 14],
  ":": [0, 4, 4, 0, 4, 4, 0],
  "-": [0, 0, 0, 31, 0, 0, 0],
  " ": [0, 0, 0, 0, 0, 0, 0],
};
export function checkPixels(data, width, height) {
  if (
    !(data instanceof Uint8ClampedArray) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1704 ||
    height > 1704 ||
    data.length !== width * height * 4
  )
    throw new Error("The teaching image dimensions are invalid.");
}
export function nonymise(original, width, height) {
  checkPixels(original, width, height);
  if (width < 400 || height > 1600)
    throw new Error("This exercise needs a supported teaching image.");
  const rows = height + HEADER + FOOTER,
    baseline = new Uint8ClampedArray(width * rows * 4);
  for (let i = 3; i < baseline.length; i += 4) baseline[i] = 255;
  baseline.set(original, HEADER * width * 4);
  const pixels = baseline.slice(),
    ink = new Uint8Array(width * rows);
  function text(value, y) {
    if (12 + value.length * 12 > width)
      throw new Error("The fake label would not fit.");
    [...value].forEach((char, column) =>
      glyphs[char].forEach((bits, row) => {
        for (let x = 0; x < 5; x++)
          if (bits & (1 << (4 - x)))
            for (let sy = 0; sy < 2; sy++)
              for (let sx = 0; sx < 2; sx++) {
                const n =
                  (y + row * 2 + sy) * width + 12 + column * 12 + x * 2 + sx;
                pixels.set([255, 255, 255, 255], n * 4);
                ink[n] = 1;
              }
      }),
    );
  }
  text("FAKE NAME: ALEX EXAMPLE", 4);
  text("FAKE ID: TRAINING 0001", 24);
  text("FAKE DOB: 2000-01-01", 44);
  text("FAKE SITE: EXAMPLE HOSPITAL", HEADER + height + 10);
  return {
    pixels,
    baseline,
    ink,
    width,
    height: rows,
    labels: [
      { x: 0, y: 0, width, height: HEADER },
      { x: 0, y: HEADER + height, width, height: FOOTER },
    ],
  };
}
export function validateRegions(regions, width, height) {
  if (!Array.isArray(regions) || !regions.length || regions.length > 32)
    throw new Error("Select between 1 and 32 rectangles.");
  for (const r of regions)
    if (
      !r ||
      Object.keys(r).sort().join(",") !== "height,width,x,y" ||
      Object.values(r).some((v) => !Number.isInteger(v)) ||
      r.x < 0 ||
      r.y < 0 ||
      r.width < 1 ||
      r.height < 1 ||
      r.x + r.width > width ||
      r.y + r.height > height
    )
      throw new Error("Enter whole-number rectangles inside the image.");
}
export function erase(pixels, width, height, regions) {
  checkPixels(pixels, width, height);
  validateRegions(regions, width, height);
  const next = pixels.slice();
  for (const r of regions)
    for (let y = r.y; y < r.y + r.height; y++)
      for (let x = r.x; x < r.x + r.width; x++)
        next.set([0, 0, 0, 255], (y * width + x) * 4);
  verifyErase(pixels, next, width, height, regions);
  return next;
}
export function verifyErase(before, after, width, height, regions) {
  checkPixels(before, width, height);
  checkPixels(after, width, height);
  validateRegions(regions, width, height);
  let selected = 0;
  // Independent full-image pass checks all four channels, including alpha.
  for (let n = 0; n < width * height; n++) {
    const x = n % width,
      y = Math.floor(n / width),
      inside = regions.some(
        (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height,
      );
    if (inside) selected++;
    for (let c = 0; c < 4; c++)
      if (
        after[n * 4 + c] !== (inside ? (c === 3 ? 255 : 0) : before[n * 4 + c])
      )
        throw new Error(
          "Pixel verification failed. No verified export is available.",
        );
  }
  return {
    selected_pixels: selected,
    unchanged_outside_pixels: width * height - selected,
  };
}
export function remainingInk(pixels, ink) {
  if (pixels.length !== ink.length * 4)
    throw new Error("Label check dimensions differ.");
  let count = 0;
  for (let n = 0; n < ink.length; n++)
    if (
      ink[n] &&
      (pixels[n * 4] !== 0 ||
        pixels[n * 4 + 1] !== 0 ||
        pixels[n * 4 + 2] !== 0 ||
        pixels[n * 4 + 3] !== 255)
    )
      count++;
  return count;
}
export function equalBytes(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
