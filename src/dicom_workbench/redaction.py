"""Stored-pixel replacement and an independently indexed output check.

Rectangles use half-open source pixel coordinates: x <= column < x + width.
No claim is made that a user's chosen rectangles cover all identifying content.
"""

from array import array
import sys

MAX_REGIONS = 32


def checked_regions(regions, rows, columns):
    from .core import Unsupported

    if not isinstance(regions, list) or not 1 <= len(regions) <= MAX_REGIONS:
        raise Unsupported("Choose between 1 and 32 rectangular regions.")
    result = []
    for box in regions:
        if not isinstance(box, dict) or set(box) != {"x", "y", "width", "height"}:
            raise Unsupported("Each region needs x, y, width and height in image pixels.")
        if any(type(value) is not int for value in box.values()):
            raise Unsupported("Region coordinates must be whole numbers.")
        x, y, width, height = (box[k] for k in ("x", "y", "width", "height"))
        if x < 0 or y < 0 or width < 1 or height < 1 or x + width > columns or y + height > rows:
            raise Unsupported("A selected region is outside the image.")
        result.append(dict(box))
    return result


def replace_pixels(ds, regions):
    boxes = checked_regions(regions, ds.Rows, ds.Columns)
    # Constant stored value, independent of the original content. MONOCHROME1 and
    # negative rescale reverse brightness; choose the corresponding dark endpoint.
    low, high = (-32768, 32767) if ds.PixelRepresentation else (0, 65535)
    reverse = (ds.PhotometricInterpretation == "MONOCHROME1") != (
        float(ds.get("RescaleSlope", 1)) < 0
    )
    fill = high if reverse else low
    unit = fill.to_bytes(2, "little", signed=bool(ds.PixelRepresentation))
    output = bytearray(ds.PixelData)
    for box in boxes:
        for row in range(box["y"], box["y"] + box["height"]):
            start = 2 * (row * ds.Columns + box["x"])
            output[start : start + 2 * box["width"]] = unit * box["width"]
    return bytes(output), boxes, fill


def verify_pixels(before, after, rows, columns, regions, fill, signed):
    """Different implementation from the writer: decode and inspect every pixel."""
    from .core import Unsupported

    if len(before) != rows * columns * 2 or len(after) != len(before):
        raise Unsupported("Pixel verification failed: unexpected buffer size.")
    a, b = array("h" if signed else "H"), array("h" if signed else "H")
    a.frombytes(before)
    b.frombytes(after)
    if sys.byteorder != "little":
        a.byteswap()
        b.byteswap()
    selected = changed = 0
    for index, (old, new) in enumerate(zip(a, b)):
        row, col = divmod(index, columns)
        inside = any(
            r["x"] <= col < r["x"] + r["width"] and r["y"] <= row < r["y"] + r["height"]
            for r in regions
        )
        if inside:
            selected += 1
            changed += old != new
            if new != fill:
                raise Unsupported("Pixel verification failed: a selected pixel was not erased.")
        elif new != old:
            raise Unsupported("Pixel verification failed: pixels outside the selection changed.")
    return selected, changed
