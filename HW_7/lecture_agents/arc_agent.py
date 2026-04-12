from __future__ import annotations

import json as _json
import logging
from pathlib import Path
from typing import Any

from lecture_agents.llm_client import GeminiClient
from lecture_agents.util_io import atomic_write_json, read_json

log = logging.getLogger(__name__)

ARC_SYSTEM = """You design a narrative arc for a lecture video narration.
Return only valid JSON. The arc must be consistent with the premise and the slide order implied by descriptions."""


def run_arc_agent(
    premise: dict[str, Any],
    slide_descriptions: dict[str, Any],
    out_path: Path,
    *,
    force: bool = False,
) -> dict[str, Any]:
    if out_path.exists() and not force:
        log.info("Skipping arc: %s exists", out_path)
        return read_json(out_path)

    client = GeminiClient()
    prompt = f"""premise.json:
{_json.dumps(premise, ensure_ascii=False, indent=2)}

slide_description.json:
{_json.dumps(slide_descriptions, ensure_ascii=False, indent=2)}

Return JSON with keys:
- acts: array of objects with fields: name (string), slide_range (string like "1-5"), purpose (string)
- throughline (string): one sentence story of how ideas build
- transitions: array of strings (how to move between major sections)
- pacing_notes (string): how density changes across the deck
"""

    data = client.generate_json(prompt, system_instruction=ARC_SYSTEM)
    atomic_write_json(out_path, data)
    log.info("Wrote %s", out_path)
    return data
