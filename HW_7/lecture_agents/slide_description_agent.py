from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from lecture_agents.llm_client import GeminiClient
from lecture_agents.util_io import atomic_write_json, read_json

log = logging.getLogger(__name__)

SLIDE_DESC_SYSTEM = """You describe presentation slides faithfully for accessibility and downstream narration.
Return only valid JSON with a single key "description" whose value is a string.
Build on prior slide descriptions when relevant (themes, definitions, running examples)."""


def _prior_block(prior: list[dict[str, Any]]) -> str:
    if not prior:
        return "(No prior slides yet.)"
    lines = []
    for item in prior:
        idx = item.get("slide_index")
        desc = item.get("description", "")
        lines.append(f"Slide {idx}: {desc}")
    return "\n".join(lines)


def describe_one_slide(
    client: GeminiClient,
    image_png: Path,
    slide_index: int,
    total_slides: int,
    prior_descriptions: list[dict[str, Any]],
) -> str:
    prompt = f"""You are on slide {slide_index} of {total_slides}.

Here are descriptions of all previous slides, in order:
{_prior_block(prior_descriptions)}

Describe ONLY what is visible on the current slide image: titles, bullets, diagrams, code, photos, and how they relate to prior slides when relevant.
Be concrete; do not invent content not shown.

Return JSON: {{"description": "..."}}"""

    out = client.generate_json(prompt, system_instruction=SLIDE_DESC_SYSTEM, image_png=image_png)
    desc = out.get("description")
    if not isinstance(desc, str) or not desc.strip():
        raise RuntimeError(f"Bad slide description JSON for slide {slide_index}: {out!r}")
    return desc.strip()


def run_slide_description_agent(
    slide_images: list[Path],
    out_path: Path,
    *,
    force: bool = False,
) -> list[dict[str, Any]]:
    if out_path.exists() and not force:
        log.info("Skipping slide descriptions: %s exists", out_path)
        data = read_json(out_path)
        slides = data.get("slides")
        if not isinstance(slides, list):
            raise RuntimeError(f"Invalid slide_description.json: missing slides[] in {out_path}")
        return slides

    client = GeminiClient()
    slides_out: list[dict[str, Any]] = []
    total = len(slide_images)
    for i, png in enumerate(slide_images, start=1):
        log.info("Slide description %s/%s (%s)", i, total, png.name)
        desc = describe_one_slide(client, png, i, total, slides_out)
        slides_out.append({"slide_index": i, "description": desc})

    atomic_write_json(out_path, {"slides": slides_out})
    log.info("Wrote %s (%s slides)", out_path, len(slides_out))
    return slides_out
