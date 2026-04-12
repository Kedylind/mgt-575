from __future__ import annotations

import logging
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from lecture_agents.ffmpeg_util import concat_wavs_to_mp3, concat_wavs_to_wav, pcm16le_mono_to_wav

log = logging.getLogger(__name__)

_DEFAULT_CHUNK = 2800


def _split_tts_chunks(text: str, max_chars: int = _DEFAULT_CHUNK) -> list[str]:
    t = " ".join(text.split())
    if len(t) <= max_chars:
        return [t]
    parts: list[str] = []
    cursor = 0
    while cursor < len(t):
        end = min(cursor + max_chars, len(t))
        chunk = t[cursor:end]
        if end < len(t):
            cut = None
            for sep in [". ", "? ", "! ", "; ", ", "]:
                idx = chunk.rfind(sep)
                if idx > max_chars // 2:
                    cut = idx + len(sep)
                    break
            if cut is not None:
                chunk = t[cursor : cursor + cut]
                end = cursor + cut
        chunk = chunk.strip()
        if chunk:
            parts.append(chunk)
        cursor = end if end > cursor else len(t)
    return parts if parts else [t]


def _collect_audio_parts(response: Any) -> list[tuple[bytes, str | None]]:
    out: list[tuple[bytes, str | None]] = []
    cands = getattr(response, "candidates", None) or []
    if not cands:
        return out
    content = cands[0].content
    parts = getattr(content, "parts", None) or []
    for p in parts:
        inline = getattr(p, "inline_data", None)
        if inline is None:
            continue
        data = getattr(inline, "data", None)
        mime = getattr(inline, "mime_type", None)
        if data:
            out.append((data, mime))
    return out


def _parts_to_wav_files(parts: list[tuple[bytes, str | None]], tmpdir: Path) -> list[Path]:
    wavs: list[Path] = []
    for i, (data, mime) in enumerate(parts):
        mime_l = (mime or "").lower()
        path = tmpdir / f"part_{i:03d}.wav"
        if "wav" in mime_l:
            path.write_bytes(data)
        elif "l16" in mime_l or "pcm" in mime_l:
            sr = 24000
            m = re.search(r"rate=(\d+)", mime_l)
            if m:
                sr = int(m.group(1))
            pcm16le_mono_to_wav(data, path, sample_rate_hz=sr)
        else:
            log.warning("Unknown audio mime %r; assuming raw s16le mono @24kHz", mime)
            pcm16le_mono_to_wav(data, path, sample_rate_hz=24000)
        wavs.append(path)
    return wavs


def synthesize_slide_to_mp3(text: str, mp3_out: Path) -> None:
    key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not key:
        raise RuntimeError("GOOGLE_API_KEY is required for TTS")
    model = os.getenv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts").strip()
    voice = os.getenv("TTS_VOICE", "Kore").strip()

    client = genai.Client(api_key=key)
    text_chunks = _split_tts_chunks(text)
    per_chunk_wavs: list[Path] = []

    with tempfile.TemporaryDirectory(prefix="hw7_tts_") as td:
        tmpdir = Path(td)
        for ci, chunk in enumerate(text_chunks, start=1):
            log.info("TTS chunk %s/%s (%s chars)", ci, len(text_chunks), len(chunk))
            prompt = (
                "Read the following lecture narration aloud in one continuous take. "
                "Use natural pacing and intonation suitable for a classroom lecture.\n\n"
                f"{chunk}"
            )
            resp = client.models.generate_content(
                model=model,
                contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice
                            )
                        )
                    ),
                ),
            )
            parts = _collect_audio_parts(resp)
            if not parts:
                raise RuntimeError(
                    f"TTS returned no audio parts (chunk {ci}). Response may be blocked or empty."
                )
            chunk_dir = tmpdir / f"c_{ci:03d}"
            chunk_dir.mkdir(parents=True, exist_ok=True)
            wav_files = _parts_to_wav_files(parts, chunk_dir)
            merged = tmpdir / f"chunk_{ci:03d}.wav"
            if len(wav_files) == 1:
                import shutil

                shutil.copyfile(wav_files[0], merged)
            else:
                concat_wavs_to_wav(wav_files, merged)
            per_chunk_wavs.append(merged)

        concat_wavs_to_mp3(per_chunk_wavs, mp3_out)
