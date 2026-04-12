from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

log = logging.getLogger(__name__)


def require_ffmpeg() -> None:
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        print(
            "ERROR: ffmpeg was not found on PATH. Install ffmpeg and try again.\n"
            "Windows: winget install FFmpeg, or download from https://ffmpeg.org/\n"
            "macOS: brew install ffmpeg\n"
            "Linux: sudo apt install ffmpeg (Debian/Ubuntu)",
            file=sys.stderr,
        )
        raise SystemExit(2) from None
    except subprocess.CalledProcessError as e:
        print("ERROR: ffmpeg exists but failed to run:", e, file=sys.stderr)
        raise SystemExit(2) from e


def run_ffmpeg(args: list[str]) -> None:
    log.debug("ffmpeg %s", " ".join(args))
    p = subprocess.run(
        ["ffmpeg", *args],
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        err = (p.stderr or p.stdout or "").strip()
        raise RuntimeError(f"ffmpeg failed (exit {p.returncode}): {err[:4000]}")


def concat_wavs_to_wav(wav_paths: list[Path], wav_out: Path) -> None:
    if not wav_paths:
        raise ValueError("No WAV inputs")
    wav_out.parent.mkdir(parents=True, exist_ok=True)
    if len(wav_paths) == 1:
        import shutil

        shutil.copyfile(wav_paths[0], wav_out)
        return
    list_path = wav_out.parent / "_concat_wav_list.txt"
    lines = [f"file '{p.resolve().as_posix()}'" for p in wav_paths]
    list_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
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
                wav_out.as_posix(),
            ]
        )
    finally:
        try:
            list_path.unlink()
        except OSError:
            pass


def concat_wavs_to_mp3(wav_paths: list[Path], mp3_out: Path) -> None:
    if not wav_paths:
        raise ValueError("No WAV inputs")
    mp3_out.parent.mkdir(parents=True, exist_ok=True)
    if len(wav_paths) == 1:
        run_ffmpeg(
            [
                "-y",
                "-i",
                wav_paths[0].as_posix(),
                "-codec:a",
                "libmp3lame",
                "-q:a",
                "2",
                mp3_out.as_posix(),
            ]
        )
        return

    list_path = mp3_out.parent / "_concat_audio_list.txt"
    lines = [f"file '{p.resolve().as_posix()}'" for p in wav_paths]
    list_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
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
                "-codec:a",
                "libmp3lame",
                "-q:a",
                "2",
                mp3_out.as_posix(),
            ]
        )
    finally:
        try:
            list_path.unlink()
        except OSError:
            pass


def pcm16le_mono_to_wav(pcm: bytes, wav_out: Path, sample_rate_hz: int = 24000) -> None:
    import wave

    wav_out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(wav_out.as_posix(), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate_hz)
        wf.writeframes(pcm)
