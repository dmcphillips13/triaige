"""Build OpenAI vision API message payloads for screenshot analysis.

Pure data preparation — no LLM calls. Formats baseline, actual, and diff
overlay screenshots as base64 image_url content parts alongside diff metrics.
The actual GPT-4o call happens in the analyze_screenshots graph node.
"""

from app.agent.prompts import VISION_SYSTEM_PROMPT
from app.schemas import ImageDiff, PRContext


def build_vision_messages(
    baseline_b64: str,
    actual_b64: str,
    diff_overlay_b64: str | None,
    diff_metrics: ImageDiff | None,
    pr_context: PRContext | None = None,
) -> list[dict]:
    """Build the message list for an OpenAI vision API call."""
    # User message: images + metrics text
    content_parts: list[dict] = []

    # PR context first so the model knows what to look for
    if pr_context:
        pr_lines = []
        if pr_context.title:
            pr_lines.append(f"PR title: {pr_context.title}")
        if pr_context.changed_files:
            pr_lines.append(f"Changed files: {', '.join(pr_context.changed_files[:10])}")
        if pr_context.commit_messages:
            pr_lines.append(f"Commits: {'; '.join(pr_context.commit_messages[:5])}")
        if pr_lines:
            content_parts.append({
                "type": "text",
                "text": "PR CONTEXT:\n" + "\n".join(pr_lines),
            })

    content_parts.append({
        "type": "text",
        "text": "BASELINE screenshot:",
    })
    content_parts.append(_image_part(baseline_b64))

    content_parts.append({
        "type": "text",
        "text": "ACTUAL screenshot:",
    })
    content_parts.append(_image_part(actual_b64))

    if diff_overlay_b64:
        content_parts.append({
            "type": "text",
            "text": "DIFF OVERLAY (changed pixels in red):",
        })
        content_parts.append(_image_part(diff_overlay_b64))

    if diff_metrics:
        metrics_text = (
            f"Diff metrics: {diff_metrics.diff_ratio * 100:.1f}% of pixels changed "
            f"({diff_metrics.changed_pixel_count:,} / {diff_metrics.total_pixel_count:,}). "
            f"Changed regions: {', '.join(diff_metrics.changed_regions) or 'none detected'}."
        )
        content_parts.append({"type": "text", "text": metrics_text})

    return [
        {"role": "system", "content": VISION_SYSTEM_PROMPT},
        {"role": "user", "content": content_parts},
    ]


def _image_part(b64: str) -> dict:
    """Build an image_url content part from a base64 PNG string."""
    return {
        "type": "image_url",
        "image_url": {
            "url": f"data:image/png;base64,{b64}",
            "detail": "auto",
        },
    }
