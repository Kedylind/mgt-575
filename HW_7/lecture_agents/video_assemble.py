from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from lecture_agents.ffmpeg_util import run_ffmpeg

log = logging.getLogger(__name__)


def mux_still_image_with_audio(
    png_path: Path,
    mp3_path: Path,
    segment_mp4: Path,
) -> None:
    segment_mp4.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg(
        [
            "-y",
            "-loop",
            "1",
            "-i",
            png_path.as_posix(),
            "-i",
            mp3_path.as_posix(),
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-pix_fmt",
            "yuv420p",
            segment_mp4.as_posix(),
        ]
    )


def concat_segments(segment_mp4s: list[Path], out_mp4: Path) -> None:
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    if not segment_mp4s:
        raise ValueError("No segments to concatenate")
    if len(segment_mp4s) == 1:
        import shutil

        shutil.copyfile(segment_mp4s[0], out_mp4)
        return

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".txt",
        delete=False,
        encoding="utf-8",
    ) as f:
        for p in segment_mp4s:
            f.write(f"file '{p.resolve().as_posix()}'\n")
        list_path = Path(f.name)

    try:
        run_ffmpeg(
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                list_path.as_posix(),
                "-c",
                "copy",
                out_mp4.as_posix(),
            ]
        )
    finally:
        try:
            list_path.unlink()
        except OSError:
            pass


def assemble_lecture_video(
    slide_images: list[Path],
    audio_mp3s: list[Path],
    out_mp4: Path,
) -> None:
    if len(slide_images) != len(audio_mp3s):
        raise RuntimeError(
            f"Slide/audio count mismatch: {len(slide_images)} PNG vs {len(audio_mp3s)} MP3"
        )

    with tempfile.TemporaryDirectory(prefix="hw7_vid_") as td:
        tmp = Path(td)
        segments: list[Path] = []
        for i, (img, aud) in enumerate(zip(slide_images, audio_mp3s), start=1):
            seg = tmp / f"seg_{i:03d}.mp4"
            log.info("Mux segment %s/%s", i, len(slide_images))
            mux_still_image_with_audio(img, aud, seg)
            segments.append(seg)
        log.info("Concatenating %s segments -> %s", len(segments), out_mp4.name)
        concat_segments(segments, out_mp4)
