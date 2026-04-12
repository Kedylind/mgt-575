#!/usr/bin/env python3
"""
Homework 7 — single entrypoint for the agentic lecture video pipeline.
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv

from lecture_agents.arc_agent import run_arc_agent
from lecture_agents.ffmpeg_util import require_ffmpeg
from lecture_agents.narration_agent import run_narration_agent
from lecture_agents.paths import default_pdf_path, default_transcript_path, repo_root
from lecture_agents.pdf_raster import list_slide_images, rasterize_pdf
from lecture_agents.premise_agent import run_premise_agent
from lecture_agents.slide_description_agent import run_slide_description_agent
from lecture_agents.style_agent import load_style, run_style_agent
from lecture_agents.tts import synthesize_slide_to_mp3
from lecture_agents.util_io import read_json
from lecture_agents.video_assemble import assemble_lecture_video

log = logging.getLogger(__name__)

STAGES = [
    "style",
    "raster",
    "descriptions",
    "premise",
    "arc",
    "narration",
    "tts",
    "video",
]

OFFICIAL_TRANSCRIPT_URL = (
    "https://zlisto.github.io/genAI_social_media/slides_pdf/"
    "MGT%20575%2001-02%20(SP26)_%20%20Generative%20AI%20and%20Social%20Media%20"
    "Lecture%2011%20Section%202_Captions_English%20(United%20States).txt"
)


def _stage_index(name: str) -> int:
    try:
        return STAGES.index(name)
    except ValueError as e:
        raise argparse.ArgumentTypeError(
            f"Unknown stage {name!r}. Choose from: {', '.join(STAGES)}"
        ) from e


def _should_run(stage: str, from_stage: str | None) -> bool:
    if from_stage is None:
        return True
    return _stage_index(stage) >= _stage_index(from_stage)


def _create_project_dir(projects_root: Path) -> Path:
    projects_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    d = projects_root / f"project_{stamp}"
    d.mkdir(parents=True, exist_ok=False)
    log.info("Created project directory %s", d)
    return d


def _fetch_transcript(out_path: Path) -> None:
    log.info("Downloading official transcript -> %s", out_path)
    r = httpx.get(OFFICIAL_TRANSCRIPT_URL, timeout=120.0, follow_redirects=True)
    r.raise_for_status()
    out_path.write_text(r.text, encoding="utf-8")
    log.info("Wrote %s bytes", len(r.text))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Agentic lecture pipeline (Homework 7)")
    parser.add_argument(
        "--from-stage",
        type=str,
        default=None,
        choices=STAGES,
        help="Resume from this stage (earlier stages are skipped unless outputs are missing)",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=None,
        help="Use an existing projects/project_... folder (required for most resumes)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate outputs even if they already exist",
    )
    parser.add_argument(
        "--skip-tts",
        action="store_true",
        help="Stop after narration JSON (no MP3 / MP4)",
    )
    parser.add_argument(
        "--fetch-transcript",
        action="store_true",
        help=(
            "Download official captions to TRANSCRIPT_PATH and exit. URL: "
            + OFFICIAL_TRANSCRIPT_URL.replace("%", "%%")
        ),
    )
    args = parser.parse_args(argv)

    root = repo_root()
    load_dotenv(root / ".env")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.fetch_transcript:
        tp = default_transcript_path()
        _fetch_transcript(tp)
        return 0

    from_stage = args.from_stage

    pdf_path = default_pdf_path()
    if not pdf_path.is_file():
        log.error("PDF not found: %s", pdf_path)
        return 1

    transcript_path = default_transcript_path()
    style_path = root / "style.json"

    projects_root = root / "projects"
    project_dir: Path | None = (
        args.project_dir.resolve() if args.project_dir is not None else None
    )
    if project_dir is not None and not project_dir.is_dir():
        log.error("Project dir does not exist: %s", project_dir)
        return 1

    if project_dir is None:
        if from_stage is not None and _stage_index(from_stage) > _stage_index("raster"):
            log.error(
                "When resuming from %s, pass --project-dir to an existing projects/project_* folder.",
                from_stage,
            )
            return 1
        project_dir = _create_project_dir(projects_root)

    slide_images_dir = project_dir / "slide_images"
    audio_dir = project_dir / "audio"
    desc_path = project_dir / "slide_description.json"
    premise_path = project_dir / "premise.json"
    arc_path = project_dir / "arc.json"
    narr_path = project_dir / "slide_description_narration.json"
    pdf_stem = pdf_path.stem
    out_mp4 = project_dir / f"{pdf_stem}.mp4"

    try:
        if _should_run("style", from_stage):
            run_style_agent(transcript_path, style_path, force=args.force)

        if _should_run("raster", from_stage):
            n = rasterize_pdf(pdf_path, slide_images_dir)
            log.info("Rasterized %s pages", n)

        slide_images = list_slide_images(slide_images_dir)
        if not slide_images:
            raise RuntimeError(f"No slide PNGs in {slide_images_dir}")

        slide_description_doc: dict | None = None
        if _should_run("descriptions", from_stage):
            slides = run_slide_description_agent(
                slide_images, desc_path, force=args.force
            )
            slide_description_doc = {"slides": slides}
        else:
            slide_description_doc = read_json(desc_path)

        if _should_run("premise", from_stage):
            premise = run_premise_agent(
                slide_description_doc, premise_path, force=args.force
            )
        else:
            premise = read_json(premise_path)

        if _should_run("arc", from_stage):
            arc = run_arc_agent(
                premise, slide_description_doc, arc_path, force=args.force
            )
        else:
            arc = read_json(arc_path)

        style = load_style(style_path)

        if _should_run("narration", from_stage):
            run_narration_agent(
                slide_images,
                slide_description_doc,
                style,
                premise,
                arc,
                narr_path,
                force=args.force,
            )

        if args.skip_tts:
            log.info("--skip-tts: stopping before TTS/video.")
            return 0

        if _should_run("tts", from_stage) or _should_run("video", from_stage):
            require_ffmpeg()

        narr_doc = read_json(narr_path)
        narr_slides = narr_doc.get("slides")
        if not isinstance(narr_slides, list) or len(narr_slides) != len(slide_images):
            raise RuntimeError(
                f"narration slide count mismatch: json={len(narr_slides) if isinstance(narr_slides, list) else 'n/a'} "
                f"images={len(slide_images)}"
            )

        if _should_run("tts", from_stage):
            audio_dir.mkdir(parents=True, exist_ok=True)
            for item in narr_slides:
                idx = int(item["slide_index"])
                text = str(item.get("narration", "")).strip()
                if not text:
                    raise RuntimeError(f"Empty narration for slide {idx}")
                mp3 = audio_dir / f"slide_{idx:03d}.mp3"
                if mp3.is_file() and not args.force:
                    log.info("Skipping existing %s", mp3.name)
                    continue
                log.info("TTS slide %s/%s -> %s", idx, len(narr_slides), mp3.name)
                synthesize_slide_to_mp3(text, mp3)

        if _should_run("video", from_stage):
            mp3s = [audio_dir / f"slide_{i:03d}.mp3" for i in range(1, len(slide_images) + 1)]
            missing = [p for p in mp3s if not p.is_file()]
            if missing:
                raise RuntimeError(f"Missing audio files: {missing[:3]}...")
            assemble_lecture_video(slide_images, mp3s, out_mp4)
            log.info("Final video: %s", out_mp4)

    except RuntimeError as e:
        log.error("%s", e)
        return 1
    except KeyboardInterrupt:
        log.error("Interrupted")
        return 130

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
