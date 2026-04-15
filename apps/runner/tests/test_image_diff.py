"""Tests for pixel-level image diffing."""

import base64
import io

from PIL import Image

from app.tools.image_diff import _detect_regions, compute_diff


def _make_image(width: int = 90, height: int = 90, color: tuple = (255, 0, 0)) -> str:
    """Create a solid-color PNG as base64."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _make_image_with_block(
    width: int = 90, height: int = 90,
    bg: tuple = (255, 255, 255),
    block_color: tuple = (255, 0, 0),
    block_x: int = 0, block_y: int = 0,
    block_size: int = 30,
) -> str:
    """Create an image with a colored block at a specific position."""
    img = Image.new("RGB", (width, height), bg)
    for x in range(block_x, min(block_x + block_size, width)):
        for y in range(block_y, min(block_y + block_size, height)):
            img.putpixel((x, y), block_color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


# --- compute_diff ---


def test_identical_images_have_zero_diff():
    img = _make_image(color=(128, 128, 128))
    result = compute_diff(img, img)
    assert result.diff_ratio == 0.0
    assert result.changed_pixel_count == 0
    assert result.changed_regions == []


def test_completely_different_images():
    white = _make_image(color=(255, 255, 255))
    black = _make_image(color=(0, 0, 0))
    result = compute_diff(white, black)
    assert result.diff_ratio == 1.0
    assert result.changed_pixel_count == 90 * 90


def test_partial_diff():
    """A block change in the top-left should produce a partial diff."""
    baseline = _make_image(color=(255, 255, 255))
    actual = _make_image_with_block(bg=(255, 255, 255), block_color=(0, 0, 0), block_x=0, block_y=0)
    result = compute_diff(baseline, actual)
    assert 0 < result.diff_ratio < 1.0
    assert result.changed_pixel_count == 30 * 30
    assert "top-left" in result.changed_regions


def test_size_mismatch_handled():
    """Different-sized images should still produce a result."""
    small = _make_image(width=60, height=60, color=(255, 255, 255))
    large = _make_image(width=90, height=90, color=(0, 0, 0))
    result = compute_diff(small, large)
    assert result.total_pixel_count == 60 * 60  # resized to baseline dimensions


def test_diff_overlay_is_valid_png():
    white = _make_image(color=(255, 255, 255))
    black = _make_image(color=(0, 0, 0))
    result = compute_diff(white, black)
    assert result.diff_overlay_base64 is not None
    decoded = base64.b64decode(result.diff_overlay_base64)
    img = Image.open(io.BytesIO(decoded))
    assert img.size == (90, 90)


# --- _detect_regions ---


def test_detect_regions_no_changes():
    """A blank mask should produce no regions."""
    mask = Image.new("L", (90, 90), 0)
    assert _detect_regions(mask) == []


def test_detect_regions_top_left():
    """Changes in the top-left 30x30 should report 'top-left'."""
    mask = Image.new("L", (90, 90), 0)
    for x in range(30):
        for y in range(30):
            mask.putpixel((x, y), 255)
    regions = _detect_regions(mask)
    assert "top-left" in regions
    assert "bottom-right" not in regions


def test_detect_regions_bottom_right():
    """Changes in the bottom-right should report 'bottom-right'."""
    mask = Image.new("L", (90, 90), 0)
    for x in range(60, 90):
        for y in range(60, 90):
            mask.putpixel((x, y), 255)
    regions = _detect_regions(mask)
    assert "bottom-right" in regions
    assert "top-left" not in regions


def test_detect_regions_all():
    """A fully white mask should report all 9 regions."""
    mask = Image.new("L", (90, 90), 255)
    regions = _detect_regions(mask)
    assert len(regions) == 9
