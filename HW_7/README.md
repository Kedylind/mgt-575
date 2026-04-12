# Homework 7 — Agentic Video Lecture Pipeline

Single entrypoint: `run_lecture_pipeline.py`. It builds `style.json`, rasterizes the slide PDF, runs vision/text agents for descriptions → premise → arc → narrations, synthesizes audio with Gemini TTS, and muxes a final MP4 whose basename matches the PDF (for example `Lecture_17_AI_screenplays.mp4`).

Assignment reference: [Homework 7 — Agentic Video Lecture Pipeline](https://zlisto.github.io/genAI_social_media/hw7.html).

## Requirements

- **Python 3.11+** (tested with 3.12+; 3.14 should work if dependencies install).
- **ffmpeg** on `PATH` (required from the TTS stage onward: MP3 encoding and video assembly).
- **Google AI Studio API key** with access to the configured Gemini models (vision + JSON agents use `GEMINI_MODEL`; TTS uses `GEMINI_TTS_MODEL`).

### ffmpeg install

- **Windows:** `winget install FFmpeg`, or install from [ffmpeg.org](https://ffmpeg.org/) and add `bin` to PATH.
- **macOS:** `brew install ffmpeg`
- **Linux (Debian/Ubuntu):** `sudo apt install ffmpeg`

The pipeline exits with a clear error if `ffmpeg` is missing when TTS or video runs.

### PDF rasterization

Slides are rendered with **PyMuPDF** (`import fitz`) to `slide_images/slide_001.png`, … No separate Poppler install is required.

## Setup

```bash
cd HW_7
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env`: set `GOOGLE_API_KEY`, and adjust `GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `TTS_VOICE`, `PDF_PATH`, and `TRANSCRIPT_PATH` if needed.

Default inputs (repo-relative to this folder):

- `Lecture_17_AI_screenplays.pdf`
- `lecture transcript file.txt` (captions for the style agent; **gitignored** so it stays local—clone the official captions with the command below, or create the file yourself)

If your transcript file is missing or empty, run:

```bash
python run_lecture_pipeline.py --fetch-transcript
```

That downloads the official captions file from the course site into `TRANSCRIPT_PATH`.

## Run

```bash
python run_lecture_pipeline.py
```

Project outputs are written under:

`projects/project_YYYYMMDD_HHMMSS/`

using the **local machine timezone** for the timestamp folder name.

Artifacts include:

- `premise.json`, `arc.json`, `slide_description.json`, `slide_description_narration.json`
- `slide_images/` (PNG, gitignored)
- `audio/` (MP3, gitignored)
- `<PDF_basename>.mp4` (gitignored)

`style.json` is written at the **homework folder root** (same directory as `run_lecture_pipeline.py`), not inside `projects/…`.

### CLI options

| Flag | Purpose |
|------|---------|
| `--from-stage {style,raster,descriptions,premise,arc,narration,tts,video}` | Resume from a stage (skips earlier stages). |
| `--project-dir PATH` | Use an existing `projects/project_*` folder (**required** when resuming past `raster`). |
| `--force` | Regenerate outputs even if files already exist (including `style.json`). |
| `--skip-tts` | Stop after narration JSON (no MP3/MP4; no ffmpeg needed). |
| `--fetch-transcript` | Download official captions; then exit. |

**Idempotency:** If `style.json` or intermediate JSON/MP3 files already exist, stages skip regeneration unless you pass `--force`.

### Video timing

Each slide segment is built with ffmpeg **`-shortest`** over a looping still image and the slide MP3, so the visual track does not extend with a long silent tail after the narration ends. Segments are concatenated with stream copy when compatible.

## Costs and runtime

- **API calls:** One style pass, *N* slide-description calls (vision), one premise, one arc, *N* narration calls (vision), and *N* TTS generations (possibly chunked per slide for long text). Costs depend on Google AI pricing and deck length (~18 slides in the bundled PDF).
- **Local CPU:** PDF rasterization and ffmpeg muxing are usually seconds to a few minutes; wall time is often dominated by API latency.

## Repo hygiene before you push

Do not commit `.env`, PNG, MP3, MP4, caption sources under `lecture transcript file.txt`, or any `*AGENT_EXECUTION_PLAN*` / `*_EXECUTION_PLAN.md` planning files (all covered in `.gitignore`). Keep the PDF at the root of what you submit, along with code, `requirements.txt`, `.env.example`, `.gitignore`, and `README.md`, plus root `style.json` and the JSON artifacts under `projects/project_*/`.

**Published tree (matches the course diagram):** `README.md`, `style.json`, `Lecture_17_AI_screenplays.pdf`, `requirements.txt`, `run_lecture_pipeline.py`, `lecture_agents/`, `projects/project_*/{premise,arc,slide_description,slide_description_narration}.json`, and supporting `/.env.example` + `/.gitignore`. Remove stray duplicate `projects/project_*` folders from experiments so only the run you want to keep remains.
