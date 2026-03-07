"""Programmatic pixel-level image diff using Pillow.

Compares two base64-encoded PNG screenshots and returns diff metrics
(ratio, changed pixel count, changed regions) plus a highlighted overlay
image. No LLM calls — this is a pure deterministic computation tool.

The diff overlay highlights changed pixels in red on top of the actual
screenshot. Changed regions use a 3x3 grid (top-left, top-center, etc.)
to give a human-readable summary of where changes occurred.

Output feeds into Step 10 (GPT-4o vision) as context for qualitative analysis.
"""

import base64
import io
import logging

from PIL import Image, ImageChops

from app.schemas import ImageDiff

logger = logging.getLogger(__name__)

# Grayscale diff threshold (0-255). Pixels with a difference below this
# are treated as identical, filtering out sub-pixel anti-aliasing noise.
_THRESHOLD = 10

# 3x3 grid labels, row-major order.
_REGION_GRID = [
    ["top-left", "top-center", "top-right"],
    ["middle-left", "center", "middle-right"],
    ["bottom-left", "bottom-center", "bottom-right"],
]


def compute_diff(baseline_b64: str, actual_b64: str) -> ImageDiff:
    """Compare two base64 PNG screenshots and return diff metrics + overlay."""
    baseline = _decode_image(baseline_b64)
    actual = _decode_image(actual_b64)

    # Handle size mismatches by resizing actual to match baseline
    if baseline.size != actual.size:
        logger.warning(
            "Image size mismatch: baseline=%s actual=%s — resizing actual",
            baseline.size,
            actual.size,
        )
        actual = actual.resize(baseline.size, Image.LANCZOS)

    # Convert both to RGBA for consistent comparison
    baseline = baseline.convert("RGBA")
    actual = actual.convert("RGBA")

    # Compute pixel difference and threshold to binary mask.
    # Keep mask in "L" mode (0 or 255) for reliable counting and compositing.
    diff = ImageChops.difference(baseline, actual)
    diff_gray = diff.convert("L")
    mask = diff_gray.point(lambda p: 255 if p > _THRESHOLD else 0)

    # Count changed pixels (each changed pixel has value 255 in mask)
    total_pixel_count = baseline.size[0] * baseline.size[1]
    changed_pixel_count = sum(1 for p in mask.getdata() if p > 0)
    diff_ratio = changed_pixel_count / total_pixel_count if total_pixel_count > 0 else 0.0

    # Determine changed regions using 3x3 grid
    changed_regions = _detect_regions(mask)

    # Build red overlay on the actual screenshot
    overlay_b64 = _build_overlay(actual, mask)

    return ImageDiff(
        diff_ratio=round(diff_ratio, 6),
        changed_pixel_count=changed_pixel_count,
        total_pixel_count=total_pixel_count,
        changed_regions=changed_regions,
        diff_overlay_base64=overlay_b64,
    )


def _decode_image(b64: str) -> Image.Image:
    """Decode a base64-encoded PNG string into a Pillow Image."""
    raw = base64.b64decode(b64)
    return Image.open(io.BytesIO(raw))


def _detect_regions(mask: Image.Image) -> list[str]:
    """Check which cells in a 3x3 grid contain changed pixels."""
    w, h = mask.size
    regions = []
    for row_idx, row_labels in enumerate(_REGION_GRID):
        for col_idx, label in enumerate(row_labels):
            x0 = col_idx * w // 3
            x1 = (col_idx + 1) * w // 3
            y0 = row_idx * h // 3
            y1 = (row_idx + 1) * h // 3
            crop = mask.crop((x0, y0, x1, y1))
            if crop.getbbox() is not None:
                regions.append(label)
    return regions


def _build_overlay(actual: Image.Image, mask: Image.Image) -> str:
    """Composite red-highlighted changed pixels onto the actual screenshot."""
    # Create a solid red layer the same size as the actual image
    red = Image.new("RGBA", actual.size, (255, 0, 0, 128))
    # Mask is already "L" mode (0 or 255), use directly as alpha
    # Composite: where mask is 255, blend red onto actual
    overlay = Image.composite(red, actual, mask)

    buf = io.BytesIO()
    overlay.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")
