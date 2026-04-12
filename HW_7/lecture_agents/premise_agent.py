from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from lecture_agents.llm_client import GeminiClient
from lecture_agents.util_io import atomic_write_json, read_json

log = logging.getLogger(__name__)

PREMISE_SYSTEM = """You extract a structured lecture premise from slide descriptions.
Return only valid JSON. Ground claims in the provided descriptions; do not invent major topics not supported by them."""


def run_premise_agent(
    slide_descriptions: dict[str, Any],
    out_path: Path,
    *,
    force: bool = False,
) -> dict[str, Any]:
    if out_path.exists() and not force:
        log.info("Skipping premise: %s exists", out_path)
        return read_json(out_path)

    client = GeminiClient()
    payload = json.dumps(slide_descriptions, ensure_ascii=False, indent=2)
    prompt = f"""From the following slide_description.json content, produce premise.json-style content.

Return JSON with keys:
- thesis (string)
- scope (string)
- learning_objectives (array of strings)
- audience (string)
- key_themes (array of strings; must reflect themes visible in the slide descriptions)
- constraints_and_assumptions (array of strings)

Slide descriptions JSON:
{payload}
"""

    data = client.generate_json(prompt, system_instruction=PREMISE_SYSTEM)
    atomic_write_json(out_path, data)
    log.info("Wrote %s", out_path)
    return data
