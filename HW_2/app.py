import streamlit as st
import cv2
import os
import glob
import re
import time
import base64
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
MODEL = "gpt-5-nano"
IMAGES_DIR = "images"
MAX_IMAGES = 20
CAPTURE_INTERVAL_SECONDS = 10
PROMPT_FILE = "prompt_reaction.txt"
FINAL_PROMPT_FILE = "final_prompt.txt"
DEFAULT_PROMPT_TEMPLATE = (
    "These are chronological snapshots of a person watching the YouTube video: "
    "'{video_title}'. Please summarize their emotional reaction and engagement "
    "level based on these images."
)

if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)


def log_event(message: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {message}", flush=True)


def clear_images():
    files = glob.glob(os.path.join(IMAGES_DIR, "*.png"))
    for f in files:
        try:
            os.remove(f)
        except OSError:
            pass


# --- VIDEO ID & METADATA ---
def extract_video_id(url: str) -> str | None:
    if not url or not url.strip():
        return None
    url = url.strip()
    # https://www.youtube.com/watch?v=VIDEO_ID
    m = re.search(r"(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})", url)
    if m:
        return m.group(1)
    # https://youtu.be/VIDEO_ID
    m = re.search(r"youtu\.be/([a-zA-Z0-9_-]{11})", url)
    if m:
        return m.group(1)
    return None


def fetch_youtube_metadata(url: str) -> dict | None:
    """Fetch title, duration, description via yt-dlp. Returns dict or None on error."""
    try:
        import yt_dlp
        video_id = extract_video_id(url)
        if not video_id:
            return None
        full_url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "skip_download": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(full_url, download=False)
        if not info:
            return None
        duration = info.get("duration")
        if duration is None:
            duration = 0
        else:
            duration = int(duration)
        iframe_html = (
            f'<iframe width="560" height="315" '
            f'src="https://www.youtube.com/embed/{video_id}" '
            f'title="YouTube video player" frameborder="0" '
            f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
            f'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>'
        )
        return {
            "video_id": video_id,
            "title": info.get("title") or "Untitled",
            "duration_seconds": duration,
            "description": info.get("description") or "",
            "iframe": iframe_html,
        }
    except Exception as e:
        log_event(f"yt-dlp error: {e}")
        return None


def fetch_transcript(video_id: str) -> str:
    """Fetch transcript for video_id. Returns transcript text or placeholder."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        segments = YouTubeTranscriptApi.get_transcript(video_id)
        if not segments:
            return "No transcript available."
        return " ".join(s.get("text", "") for s in segments)
    except Exception as e:
        log_event(f"Transcript error: {e}")
        return "No transcript available."


def load_prompt_template() -> str:
    try:
        with open(PROMPT_FILE, "r", encoding="utf-8") as f:
            template = f.read().strip()
        return template if template else DEFAULT_PROMPT_TEMPLATE
    except FileNotFoundError:
        log_event(f"Prompt file '{PROMPT_FILE}' not found. Using default.")
        return DEFAULT_PROMPT_TEMPLATE
    except Exception as e:
        log_event(f"Error reading '{PROMPT_FILE}': {e}. Using default.")
        return DEFAULT_PROMPT_TEMPLATE


# --- VISUAL EVALUATION ---
def evaluate_reaction(
    video_title: str,
    video_duration_seconds: int,
    video_description: str = "",
    video_transcript: str = "",
) -> str:
    client = OpenAI()
    image_files = sorted(glob.glob(os.path.join(IMAGES_DIR, "*.png")))

    if not image_files:
        log_event(f"Visual evaluation requested for '{video_title}' but no images found.")
        return "No images found to analyze."

    prompt_template = load_prompt_template()
    num_images_to_send = min(len(image_files), MAX_IMAGES)
    try:
        prompt_text = prompt_template.format(
            video_title=video_title,
            video_duration_seconds=video_duration_seconds,
            video_description=video_description or "",
            video_transcript=video_transcript or "",
            num_images=num_images_to_send,
        )
    except KeyError:
        # Template may not have num_images
        try:
            prompt_text = prompt_template.format(
                video_title=video_title,
                video_duration_seconds=video_duration_seconds,
                video_description=video_description or "",
                video_transcript=video_transcript or "",
            )
        except Exception:
            prompt_text = f"Video: {video_title}. Duration: {video_duration_seconds}s. Images: {num_images_to_send}."
    except Exception as e:
        log_event(f"Prompt format error: {e}. Using fallback.")
        prompt_text = (
            f"Video: {video_title}. Duration: {video_duration_seconds}s. "
            f"Number of images: {num_images_to_send}. Summarize emotional reaction and engagement."
        )

    content = [{"type": "text", "text": prompt_text}]
    for img_path in image_files[:MAX_IMAGES]:
        with open(img_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{img_b64}"},
        })
    content.append({"type": "text", "text": f"Number of images provided: {num_images_to_send}"})

    try:
        log_event(f"Calling AI for '{video_title}' with {num_images_to_send} image(s).")
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": content}],
        )
        output = response.choices[0].message.content or ""
        log_event(f"Visual evaluation received ({len(output)} chars).")
        return output
    except Exception as e:
        log_event(f"AI Error: {e}")
        return f"AI Error: {e}"


# --- INTERVIEW SYSTEM PROMPT ---
def build_interview_system_prompt(metadata: dict, visual_evaluation: str) -> str:
    title = metadata.get("title", "Unknown")
    duration = metadata.get("duration_seconds", 0)
    description = (metadata.get("description") or "")[:1500]
    transcript = (metadata.get("transcript") or "")[:3000]
    return f"""You are an interviewer following the user's viewing of a YouTube video. Your role is to ask what they liked and disliked and to reference their facial expressions and reactions from the visual analysis below.

VIDEO METADATA:
- Title: {title}
- Duration (seconds): {duration}
- Description (excerpt): {description}
- Transcript (excerpt): {transcript}

VISUAL REACTION EVALUATION (from AI analysis of the user's face during the video):
{visual_evaluation}

INSTRUCTIONS:
- Reference specific moments from the visual evaluation (e.g., "I noticed you smiled around [time or moment]"; "Your expressions suggested surprise—what was that about?").
- Ask what they liked and disliked about the content.
- Keep the conversation natural and concise.
- Do not repeat the full evaluation; use it to inform your questions."""


# --- FINAL SYNTHESIS ---
def build_final_synthesis_prompt(metadata: dict, visual_evaluation: str, messages: list) -> str:
    title = metadata.get("title", "Unknown")
    duration = metadata.get("duration_seconds", 0)
    description = metadata.get("description") or "No description available."
    transcript = metadata.get("transcript") or "No transcript available."

    chat_blob = []
    for m in messages:
        role = m.get("role", "unknown")
        content = m.get("content", "")
        if isinstance(content, str):
            chat_blob.append(f"{role.upper()}: {content}")
        else:
            chat_blob.append(f"{role.upper()}: [non-text content]")
    chat_text = "\n\n".join(chat_blob)

    return f"""Based on the video metadata, the visual reaction analysis, and the following interview, write a final comprehensive sentiment report on how the user truly felt about the content.

Include: overall sentiment, alignment between facial expressions and stated opinions, key moments they mentioned, and any surprises or contradictions.

=== YOUTUBE VIDEO METADATA ===
Title: {title}
Duration (seconds): {duration}
Description: {description}
Transcript: {transcript}

=== VISUAL REACTION EVALUATION ===
{visual_evaluation}

=== INTERVIEW (CHAT HISTORY) ===
{chat_text}

Write the final synthesis report now."""


def run_final_synthesis(
    metadata: dict,
    visual_evaluation: str,
    messages: list,
) -> str:
    prompt = build_final_synthesis_prompt(metadata, visual_evaluation, messages)
    # Write exact prompt to file (Component 5)
    try:
        with open(FINAL_PROMPT_FILE, "w", encoding="utf-8") as f:
            f.write(prompt)
        log_event(f"Wrote exact final prompt to {FINAL_PROMPT_FILE}.")
    except Exception as e:
        log_event(f"Failed to write {FINAL_PROMPT_FILE}: {e}")

    client = OpenAI()
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or "No report generated."
    except Exception as e:
        log_event(f"Final synthesis API error: {e}")
        return f"Error generating report: {e}"


# --- STREAMLIT UI ---
st.set_page_config(page_title="Reaction Analyzer", layout="wide")
st.title("YouTube Content Reaction Study")

# Session state defaults
if "video_metadata" not in st.session_state:
    st.session_state.video_metadata = None
if "visual_evaluation" not in st.session_state:
    st.session_state.visual_evaluation = None
if "messages" not in st.session_state:
    st.session_state.messages = []
if "final_report" not in st.session_state:
    st.session_state.final_report = None
if "interview_started" not in st.session_state:
    st.session_state.interview_started = False
if "interview_ended" not in st.session_state:
    st.session_state.interview_ended = False
if "start_time" not in st.session_state:
    st.session_state.start_time = None
if "img_count" not in st.session_state:
    st.session_state.img_count = 0
if "last_video_id" not in st.session_state:
    st.session_state.last_video_id = None

# --- Component 1: YouTube URL input and fetch ---
st.subheader("1. Load a YouTube video")
url_input = st.text_input(
    "Paste a YouTube URL",
    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/...",
    key="youtube_url",
)
fetch_clicked = st.button("Load video", type="primary")

if fetch_clicked and url_input:
    video_id = extract_video_id(url_input)
    if not video_id:
        st.error("Could not parse a valid video ID from that URL. Use a standard YouTube watch or youtu.be link.")
    else:
        with st.spinner("Fetching metadata..."):
            meta = fetch_youtube_metadata(url_input)
        if meta is None:
            st.error("Could not fetch video (invalid URL, private video, or network error).")
        else:
            with st.spinner("Fetching transcript..."):
                meta["transcript"] = fetch_transcript(meta["video_id"])
            st.session_state.video_metadata = meta
            if st.session_state.last_video_id != meta["video_id"]:
                clear_images()
                st.session_state.last_video_id = meta["video_id"]
                st.session_state.img_count = 0
                st.session_state.start_time = None
                st.session_state.visual_evaluation = None
                st.session_state.messages = []
                st.session_state.interview_started = False
                st.session_state.interview_ended = False
                st.session_state.final_report = None
            st.success("Video loaded.")
            st.rerun()

metadata = st.session_state.video_metadata
video_ready = metadata is not None

if video_ready:
    title = metadata["title"]
    duration_seconds = metadata["duration_seconds"]
    description = metadata.get("description", "")
    transcript = metadata.get("transcript", "")
    iframe = metadata.get("iframe", "")

    st.write(f"**Title:** {title}  \n**Duration:** {duration_seconds} seconds")
    with st.expander("Description & transcript"):
        st.write("**Description:**")
        st.write(description or "—")
        st.write("**Transcript (excerpt):**")
        st.write((transcript or "—")[:2000] + ("..." if len(transcript or "") > 2000 else ""))

    _, center_col, _ = st.columns([1, 6, 1])
    with center_col:
        st.components.v1.html(
            f"<div style='display:flex; justify-content:center;'>{iframe}</div>",
            height=400,
        )
else:
    st.info("Enter a YouTube URL and click **Load video** to continue.")

# --- Recording and capture ---
st.divider()
st.subheader("2. Record your reaction")
run_study = st.toggle("Start Recording Reaction", key="run_study", disabled=not video_ready)
if not video_ready:
    st.caption("Load a video first to enable recording.")

if "last_run_study" not in st.session_state:
    st.session_state.last_run_study = run_study
elif st.session_state.last_run_study != run_study:
    log_event(f"Recording toggled to {run_study} for '{metadata.get('title') if metadata else 'N/A'}'.")
    st.session_state.last_run_study = run_study

col1, col2 = st.columns(2)
with col1:
    eval_clicked = st.button("Run Visual Evaluation", type="primary", disabled=not video_ready)
    if eval_clicked and video_ready:
        with st.spinner("Analyzing frames..."):
            summary = evaluate_reaction(
                video_title=metadata["title"],
                video_duration_seconds=metadata["duration_seconds"],
                video_description=metadata.get("description", ""),
                video_transcript=metadata.get("transcript", ""),
            )
            st.session_state.visual_evaluation = summary
        st.rerun()
with col2:
    num_captured = len(glob.glob(os.path.join(IMAGES_DIR, "*.png")))
    count_placeholder = st.empty()
    count_placeholder.write(f"Images captured: **{num_captured}** / {MAX_IMAGES}")

# Display visual evaluation in a nicely formatted way (Component 2)
if st.session_state.visual_evaluation:
    st.divider()
    with st.expander("**Visual Evaluation**", expanded=True):
        st.markdown(st.session_state.visual_evaluation)

# --- Component 3: Interview ---
st.divider()
st.subheader("3. Interview")
can_start_interview = video_ready and st.session_state.visual_evaluation is not None

if can_start_interview and not st.session_state.interview_started and not st.session_state.interview_ended:
    if st.button("Start Interview"):
        st.session_state.interview_started = True
        st.session_state.messages = [
            {
                "role": "assistant",
                "content": f"I've reviewed your reaction to **{metadata['title']}**. I'd like to ask you a few questions—what did you like or dislike, and I may reference what I noticed in your expressions."
            },
        ]
        st.rerun()

if st.session_state.interview_started and not st.session_state.interview_ended:
    system_prompt = build_interview_system_prompt(metadata, st.session_state.visual_evaluation)
    client = OpenAI()

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if prompt := st.chat_input("Your answer..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        messages_for_api = [
            {"role": "system", "content": system_prompt},
        ]
        for m in st.session_state.messages:
            if m["role"] in ("user", "assistant"):
                messages_for_api.append({"role": m["role"], "content": m["content"]})

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    response = client.chat.completions.create(
                        model=MODEL,
                        messages=messages_for_api,
                    )
                    reply = response.choices[0].message.content or ""
                except Exception as e:
                    reply = f"Error: {e}"
                st.markdown(reply)
        st.session_state.messages.append({"role": "assistant", "content": reply})
        st.rerun()

    if st.button("End Chat", key="end_chat", type="primary"):
        st.session_state.interview_ended = True
        with st.spinner("Generating final synthesis..."):
            report = run_final_synthesis(
                metadata,
                st.session_state.visual_evaluation,
                st.session_state.messages,
            )
            st.session_state.final_report = report
        st.rerun()

# --- Component 4: Final synthesis display ---
if st.session_state.final_report:
    st.divider()
    st.subheader("4. Final Synthesis Report")
    with st.expander("**Final Synthesis Report**", expanded=True):
        st.markdown(st.session_state.final_report)

# --- Background capture loop ---
if run_study and video_ready:
    if st.session_state.start_time is None:
        st.session_state.start_time = time.time()

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    status_placeholder = st.empty()
    try:
        while run_study and st.session_state.img_count < MAX_IMAGES:
            ret, frame = cap.read()
            if not ret or frame is None:
                status_placeholder.error("Could not read from webcam.")
                log_event("ERROR: Could not read from webcam.")
                break
            st.session_state.img_count += 1
            img_filename = f"screen_shot_{st.session_state.img_count:02d}.png"
            img_path = os.path.join(IMAGES_DIR, img_filename)
            ok = cv2.imwrite(img_path, frame)
            if ok:
                status_placeholder.success(f"Captured {img_filename}")
                count_placeholder.write(f"Images captured: **{st.session_state.img_count}** / {MAX_IMAGES}")
                log_event(f"Saved image: {img_filename}")
            else:
                status_placeholder.error(f"Failed to save {img_filename}")
                break
            time.sleep(CAPTURE_INTERVAL_SECONDS)
            if st.session_state.img_count >= MAX_IMAGES:
                status_placeholder.warning("Max images reached.")
                break
    finally:
        cap.release()
