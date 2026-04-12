from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

log = logging.getLogger(__name__)


def _strip_json_fences(text: str) -> str:
    t = text.strip()
    m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", t, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = _strip_json_fences(text)
    return json.loads(cleaned)


class GeminiClient:
    def __init__(self) -> None:
        key = os.environ.get("GOOGLE_API_KEY", "").strip()
        if not key:
            raise RuntimeError(
                "GOOGLE_API_KEY is missing. Copy .env.example to .env and set GOOGLE_API_KEY."
            )
        self._client = genai.Client(api_key=key)
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

    def generate_json(
        self,
        user_prompt: str,
        *,
        system_instruction: str | None = None,
        image_png: Path | None = None,
        max_retries: int = 4,
    ) -> dict[str, Any]:
        parts: list[Any] = [types.Part.from_text(text=user_prompt)]
        if image_png is not None:
            data = image_png.read_bytes()
            parts.append(types.Part.from_bytes(data=data, mime_type="image/png"))

        cfg_kwargs: dict[str, Any] = {"response_mime_type": "application/json"}
        if system_instruction:
            cfg_kwargs["system_instruction"] = system_instruction
        cfg = types.GenerateContentConfig(**cfg_kwargs)

        last_err: Exception | None = None
        for attempt in range(max_retries):
            try:
                resp = self._client.models.generate_content(
                    model=self.model,
                    contents=[types.Content(role="user", parts=parts)],
                    config=cfg,
                )
                raw = (resp.text or "").strip()
                if not raw:
                    raise ValueError("Empty model response")
                return parse_json_object(raw)
            except (json.JSONDecodeError, ValueError) as e:
                last_err = e
                log.warning("JSON parse attempt %s failed: %s", attempt + 1, e)
                time.sleep(1.5 * (attempt + 1))
        assert last_err is not None
        raise last_err
