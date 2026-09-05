// DICOM PS3.3 C.11.2 LINEAR windowing, after modality rescale.
export function gray(value, center, width, invert = false) {
  const low = center - 0.5 - (width - 1) / 2;
  const high = center - 0.5 + (width - 1) / 2;
  const level =
    value <= low
      ? 0
      : value > high
        ? 255
        : ((value - (center - 0.5)) / (width - 1) + 0.5) * 255;
  const result = Math.round(Math.max(0, Math.min(255, level)));
  return invert ? 255 - result : result;
}

export function decode(buffer, image) {
  if (buffer.byteLength !== image.rows * image.columns * 2)
    throw new Error("Pixel data is incomplete. Import the image again.");
  const view = new DataView(buffer);
  const pixels = new Float64Array(image.rows * image.columns);
  for (let i = 0; i < pixels.length; i++) {
    const stored = image.signed
      ? view.getInt16(i * 2, true)
      : view.getUint16(i * 2, true);
    pixels[i] = stored * image.slope + image.intercept;
  }
  return pixels;
}

export function rgba(pixels, center, width, invert) {
  if (!Number.isFinite(center) || !Number.isFinite(width) || width < 1)
    throw new Error("Invalid window settings.");
  const bytes = new Uint8ClampedArray(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const value = gray(pixels[i], center, width, invert);
    bytes.set([value, value, value, 255], i * 4);
  }
  return bytes;
}
