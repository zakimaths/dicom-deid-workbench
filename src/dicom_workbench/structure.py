"""Bounded structural preflight for the supported Explicit VR Little Endian envelope.

Runs before pydicom can inflate a deflated dataset or silently collapse duplicate
attributes. This is a syntax guard, not a complete DICOM or IOD validator.
"""

from struct import unpack_from

LONG_VR = {
    b"OB",
    b"OD",
    b"OF",
    b"OL",
    b"OV",
    b"OW",
    b"SQ",
    b"SV",
    b"UC",
    b"UN",
    b"UR",
    b"UT",
    b"UV",
}
SHORT_VR = {
    b"AE",
    b"AS",
    b"AT",
    b"CS",
    b"DA",
    b"DS",
    b"DT",
    b"FD",
    b"FL",
    b"IS",
    b"LO",
    b"LT",
    b"PN",
    b"SH",
    b"SL",
    b"SS",
    b"ST",
    b"TM",
    b"UI",
    b"UL",
    b"US",
}
UNDEFINED = 0xFFFFFFFF


def preflight(data):
    from .core import Unsupported

    def invalid():
        raise Unsupported("The file has malformed, repeated or unsupported DICOM structure.")

    count = 0

    def header(pos, end):
        nonlocal count
        count += 1
        if count > 10000 or pos + 8 > end:
            invalid()
        tag = unpack_from("<HH", data, pos)
        if tag[0] == 0xFFFE:
            return tag, None, unpack_from("<I", data, pos + 4)[0], pos + 8
        vr = data[pos + 4 : pos + 6]
        if vr in LONG_VR:
            if pos + 12 > end or data[pos + 6 : pos + 8] != b"\0\0":
                invalid()
            length, start = unpack_from("<I", data, pos + 8)[0], pos + 12
        elif vr in SHORT_VR:
            length, start = unpack_from("<H", data, pos + 6)[0], pos + 8
        else:
            invalid()
        if length != UNDEFINED and (length % 2 or start + length > end):
            invalid()
        return tag, vr, length, start

    pos, previous, transfer = 132, None, None
    while pos + 4 <= len(data) and unpack_from("<H", data, pos)[0] == 2:
        tag, vr, length, start = header(pos, len(data))
        if length == UNDEFINED or (previous is not None and tag <= previous):
            invalid()
        if tag == (2, 0x10):
            if vr != b"UI":
                invalid()
            transfer = data[start : start + length].rstrip(b"\0 ")
        previous, pos = tag, start + length
    if transfer != b"1.2.840.10008.1.2.1":
        raise Unsupported("Only uncompressed Explicit VR Little Endian files are supported.")

    def dataset(pos, end, depth=0, undefined=False):
        if depth > 8:
            invalid()
        previous = None
        while pos < end:
            tag, vr, length, start = header(pos, end)
            if tag == (0xFFFE, 0xE00D) and undefined and length == 0:
                return start
            if vr is None or tag[0] == 2 or (previous is not None and tag <= previous):
                invalid()
            previous = tag
            if vr == b"SQ":
                pos = sequence(
                    start,
                    end if length == UNDEFINED else start + length,
                    depth + 1,
                    length == UNDEFINED,
                )
            else:
                if length == UNDEFINED:
                    invalid()
                pos = start + length
        if undefined:
            invalid()
        return pos

    def sequence(pos, end, depth, undefined):
        while pos < end:
            tag, vr, length, start = header(pos, end)
            if tag == (0xFFFE, 0xE0DD) and undefined and length == 0:
                return start
            if tag != (0xFFFE, 0xE000):
                invalid()
            if length != UNDEFINED and (length % 2 or start + length > end):
                invalid()
            pos = dataset(
                start, end if length == UNDEFINED else start + length, depth, length == UNDEFINED
            )
        if undefined:
            invalid()
        return pos

    dataset(pos, len(data))
