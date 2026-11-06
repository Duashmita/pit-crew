"""svg render for a step the hand-drawn diagram can't show. sanitized; fixture mode returns the fallback file."""
from __future__ import annotations

import re

from . import state

RENDER_MODEL = "claude-sonnet-5-5"
FALLBACK = state.ROOT / "fixtures" / "render_fallback.svg"

PROMPT = (
    "Draw one schematic SVG for this car repair step. Output only the <svg> element, nothing else. "
    "viewBox='0 0 400 300', dark background #161B22, light strokes, label every part named in the spec, "
    "show each action's direction with an arrow, animate motion with CSS keyframes inside a <style> element, "
    "no script, no external references, no images. Put the caption 'diagram, not to scale' at the bottom."
)


def sanitize(svg: str) -> str:
    m = re.search(r"<svg\b.*?</svg>", svg, re.S | re.I)
    svg = m.group(0) if m else ""
    svg = re.sub(r"<script\b.*?</script>", "", svg, flags=re.S | re.I)
    svg = re.sub(r"<foreignObject\b.*?</foreignObject>", "", svg, flags=re.S | re.I)
    svg = re.sub(r"<(image|use)\b[^>]*(?:xlink:)?href\s*=\s*[\"'](?!#)[^\"']*[\"'][^>]*/?>", "", svg, flags=re.I)
    svg = re.sub(r"\s(?:xlink:)?href\s*=\s*[\"'](?!#)[^\"']*[\"']", "", svg, flags=re.I)
    svg = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*')", "", svg, flags=re.I)
    svg = re.sub(r"javascript:", "", svg, flags=re.I)
    return svg


def render(spec: dict) -> str:
    if state.mode() != "live":
        return FALLBACK.read_text()
    try:
        import anthropic

        client = state.anthropic_client()
        resp = client.messages.create(model=RENDER_MODEL, max_tokens=8000, system=PROMPT,
                                      messages=[{"role": "user", "content": str(spec)}])
        text = "".join(b.text for b in resp.content if b.type == "text")
        return sanitize(text) or FALLBACK.read_text()
    except Exception as e:
        print(f"[render] live render failed ({e!r}); using the fallback svg")
        return FALLBACK.read_text()
