from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from lecture_agents.llm_client import GeminiClient
from lecture_agents.util_io import atomic_write_json, read_json

log = logging.getLogger(__name__)

NARRATION_SYSTEM = """You write spoken lecture narration for a single slide at a time.
Return only valid JSON with key "narration" (string).
Match the instructor voice described in style.json: fillers, tone, pacing, signposting — without inventing biographical facts not in style/transcript evidence.
Use first person as the instructor ("I", "we") where natural.
Do not mention that you are an AI or reading JSON."""


def _prior_narrations_block(prior: list[dict[str, Any]]) -> str:
    if not prior:
        return "(No prior narrations yet.)"
    lines = []
    for item in prior:
        idx = item.get("slide_index")
        nar = item.get("narration", "")
        lines.append(f"Slide {idx}: {nar}")
    return "\n".join(lines)


def narrate_one_slide(
    client: GeminiClient,
    image_png: Path,
    slide_index: int,
    total_slides: int,
    description_for_slide: str,
    style: dict[str, Any],
    premise: dict[str, Any],
    arc: dict[str, Any],
    all_slide_descriptions: list[dict[str, Any]],
    prior_narrations: list[dict[str, Any]],
) -> str:
    title_extra = ""
    if slide_index == 1:
        title_extra = """
This is the TITLE / opening slide. The narration MUST:
- include a brief self-introduction as the instructor (do not invent a name if unknown; you may say you are teaching this session),
- and a short overview of what the lecture will cover (aligned with premise.json).
"""

    ctx = {
        "style": style,
        "premise": premise,
        "arc": arc,
        "all_slide_descriptions": all_slide_descriptions,
    }
    ctx_json = json.dumps(ctx, ensure_ascii=False, indent=2)

    prompt = f"""Slide {slide_index} of {total_slides}.
{title_extra}

style.json + premise.json + arc.json + all slide descriptions (for global context):
{ctx_json}

Current slide's description (also include this content faithfully in spirit):
{description_for_slide}

Prior narrations (do not repeat verbatim; maintain continuity):
{_prior_narrations_block(prior_narrations)}

Write narration for THIS slide only, informed by the slide IMAGE plus the context above.
Return JSON: {{"narration": "..."}}"""

    out = client.generate_json(prompt, system_instruction=NARRATION_SYSTEM, image_png=image_png)
    nar = out.get("narration")
    if not isinstance(nar, str) or not nar.strip():
        raise RuntimeError(f"Bad narration JSON for slide {slide_index}: {out!r}")
    return nar.strip()


def run_narration_agent(
    slide_images: list[Path],
    slide_description_doc: dict[str, Any],
    style: dict[str, Any],
    premise: dict[str, Any],
    arc: dict[str, Any],
    out_path: Path,
    *,
    force: bool = False,
) -> list[dict[str, Any]]:
    if out_path.exists() and not force:
        log.info("Skipping narration: %s exists", out_path)
        data = read_json(out_path)
        slides = data.get("slides")
        if not isinstance(slides, list):
            raise RuntimeError(f"Invalid narration json in {out_path}")
        return slides

    slides_in = slide_description_doc.get("slides")
    if not isinstance(slides_in, list) or len(slides_in) != len(slide_images):
        raise RuntimeError("slide_description slides[] must match slide image count")

    by_index: dict[int, str] = {}
    for item in slides_in:
        if not isinstance(item, dict):
            continue
        idx = int(item.get("slide_index", -1))
        desc = item.get("description", "")
        if isinstance(desc, str):
            by_index[idx] = desc

    client = GeminiClient()
    total = len(slide_images)
    slides_out: list[dict[str, Any]] = []

    for i, png in enumerate(slide_images, start=1):
        desc = by_index.get(i, "")
        log.info("Narration %s/%s (%s)", i, total, png.name)
        nar = narrate_one_slide(
            client,
            png,
            i,
            total,
            desc,
            style,
            premise,
            arc,
            slides_in,
            slides_out,
        )
        slides_out.append(
            {
                "slide_index": i,
                "description": desc,
                "narration": nar,
            }
        )

    atomic_write_json(out_path, {"slides": slides_out})
    log.info("Wrote %s (%s slides)", out_path, len(slides_out))
    return slides_out
