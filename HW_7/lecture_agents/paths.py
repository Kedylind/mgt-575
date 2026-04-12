from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    """Directory that contains `run_lecture_pipeline.py` (homework folder root)."""
    return Path(__file__).resolve().parent.parent


def resolve_repo_path(rel: str) -> Path:
    p = Path(rel)
    if p.is_absolute():
        return p
    return (repo_root() / p).resolve()


def default_transcript_path() -> Path:
    return resolve_repo_path(os.getenv("TRANSCRIPT_PATH", "lecture transcript file.txt"))


def default_pdf_path() -> Path:
    return resolve_repo_path(os.getenv("PDF_PATH", "Lecture_17_AI_screenplays.pdf"))
