from __future__ import annotations

import logging
from pathlib import Path

from lecture_agents.llm_client import GeminiClient
from lecture_agents.util_io import atomic_write_json, read_json

log = logging.getLogger(__name__)

STYLE_SYSTEM = """You are an analyst of spoken lecture style. You only output valid JSON.
Ground every claim in the transcript with short verbatim excerpts or close paraphrases.
Do not invent biographical facts not present in the transcript."""


def build_style_prompt(transcript: str) -> str:
    return f"""Read the following auto-generated lecture transcript (captions).

Infer the instructor's *spoken* style for later narration: tone, pacing, fillers and hedges,
how they signpost sections, how they explain vs assert, humor/sarcasm, formality level,
and any recurring rhetorical habits.

Return JSON with this shape (values must be grounded in the transcript):
{{
  "tone": "string",
  "pacing": "string",
  "fillers_and_hedges": ["string", "..."],
  "signposting": "string",
  "explanation_vs_assertion": "string",
  "humor_and_asides": "string",
  "formality": "string",
  "recurring_phrases": ["string", "..."],
  "audience_address": "string",
  "transcript_evidence": [
    {{"quote": "short verbatim snippet from transcript", "illustrates": "what this shows about style"}}
  ],
  "narration_guidance": "3-6 bullet sentences the narrator should follow to sound like this speaker"
}}

Transcript:
---
{transcript}
---
"""


def run_style_agent(
    transcript_path: Path,
    style_json_path: Path,
    *,
    force: bool = False,
) -> None:
    if style_json_path.exists() and not force:
        log.info("Skipping style: %s exists (use --force to regenerate)", style_json_path)
        return

    text = transcript_path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        raise RuntimeError(
            f"Transcript is empty: {transcript_path}. "
            "Download captions from the homework page or run: "
            "python run_lecture_pipeline.py --fetch-transcript"
        )

    client = GeminiClient()
    log.info("Running style agent (transcript chars=%s)", len(text))
    data = client.generate_json(
        build_style_prompt(text),
        system_instruction=STYLE_SYSTEM,
    )
    atomic_write_json(style_json_path, data)
    log.info("Wrote %s", style_json_path)


def load_style(style_json_path: Path) -> dict:
    return read_json(style_json_path)
