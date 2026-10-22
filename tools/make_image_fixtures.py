#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow==12.3.0"]
# ///
"""Write the scanned-image test fixtures ccitt.pdf and jpeg2000.pdf.

Each file is one A4 page that one encoded image fills. The suite measures the
ink on the drawn page, so an image that PDF.js cannot decode fails the test.
Pillow 12.3.0 writes the committed files byte for byte.

Usage: uv run tools/make_image_fixtures.py src/test/fixtures
"""

import argparse
import io
from pathlib import Path

from PIL import Image, ImageDraw, TiffImagePlugin

# TIFF tag numbers (TIFF 6.0, section 8).
PHOTOMETRIC_INTERPRETATION = 262
STRIP_OFFSETS = 273
STRIP_BYTE_COUNTS = 279


def pdf(image_dict: str, data: bytes) -> bytes:
    """Return a one-page A4 PDF that draws one image over the full page.

    Parameters
    ----------
    image_dict
        The image dictionary entries, without /Type, /Subtype and /Length.
    data
        The encoded image stream.
    """
    content = b"q 595 0 0 842 0 0 cm /Im1 Do Q\n"
    image_head = (
        f"<< /Type /XObject /Subtype /Image {image_dict} /Length {len(data)} >>"
    )
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"endstream",
        (image_head + "\nstream\n").encode("ascii") + data + b"\nendstream",
    ]
    body = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body += b"%d 0 obj\n" % number + obj + b"\nendobj\n"
    start = len(body)
    body += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        body += b"%010d 00000 n \n" % offset
    body += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        start,
    )
    return bytes(body)


def write_ccitt(out_dir: Path) -> None:
    """Write ccitt.pdf: a black rectangle and a black disc on white, 400 x 300 px.

    The image is CCITT group 4 data from a Pillow TIFF file.
    """
    width, height = 400, 300
    bilevel = Image.new("1", (width, height), 1)
    draw = ImageDraw.Draw(bilevel)
    draw.rectangle([40, 40, 199, 259], fill=0)
    draw.ellipse([220, 60, 379, 219], fill=0)
    black = bilevel.histogram()[0] / (width * height)
    buf = io.BytesIO()
    bilevel.save(buf, format="TIFF", compression="group4")
    tif = TiffImagePlugin.TiffImageFile(io.BytesIO(buf.getvalue()))
    (offset,) = tif.tag_v2[STRIP_OFFSETS]
    (count,) = tif.tag_v2[STRIP_BYTE_COUNTS]
    g4 = buf.getvalue()[offset : offset + count]
    photometric = tif.tag_v2[PHOTOMETRIC_INTERPRETATION]
    # The decoded bit for a black pixel follows the TIFF photometric value.
    black_is_1 = "false" if photometric == 0 else "true"
    ccitt = pdf(
        f"/Width {width} /Height {height} /BitsPerComponent 1 /ColorSpace /DeviceGray "
        f"/Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns {width} "
        f"/Rows {height} /BlackIs1 {black_is_1} >>",
        g4,
    )
    (out_dir / "ccitt.pdf").write_bytes(ccitt)
    print(f"ccitt.pdf {len(ccitt)} B, G4 {len(g4)} B, black fraction {black:.4f}")


def write_jpeg2000(out_dir: Path) -> None:
    """Write jpeg2000.pdf: left half blue, right half white, 40 x 30 px, lossless."""
    width, height = 40, 30
    rgb = Image.new("RGB", (width, height), (255, 255, 255))
    ImageDraw.Draw(rgb).rectangle([0, 0, width // 2 - 1, height - 1], fill=(0, 0, 255))
    buf = io.BytesIO()
    rgb.save(buf, format="JPEG2000", irreversible=False)
    j2k = buf.getvalue()
    jpx = pdf(
        f"/Width {width} /Height {height} /BitsPerComponent 8 /ColorSpace /DeviceRGB "
        "/Filter /JPXDecode",
        j2k,
    )
    (out_dir / "jpeg2000.pdf").write_bytes(jpx)
    print(f"jpeg2000.pdf {len(jpx)} B, JP2 {len(j2k)} B, blue fraction 0.5000")


def main() -> None:
    """Write both fixtures to the directory given on the command line."""
    parser = argparse.ArgumentParser(
        description="Write ccitt.pdf and jpeg2000.pdf for the scanned-image test."
    )
    parser.add_argument("out_dir", type=Path, help="directory for the two files")
    out_dir: Path = parser.parse_args().out_dir
    write_ccitt(out_dir)
    write_jpeg2000(out_dir)


if __name__ == "__main__":
    main()
