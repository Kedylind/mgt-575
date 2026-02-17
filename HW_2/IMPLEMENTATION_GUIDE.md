# HW2 Implementation Guide: Multimodal YouTube Reaction Feedback Agent

This document provides step-by-step instructions for an AI agent (or developer) to implement the assignment. The goal is to enhance the existing Streamlit app into a **feedback agent** that: (1) fetches YouTube metadata from a URL, (2) captures and evaluates the user’s visual reaction, (3) runs an AI-driven interview, and (4) produces a final synthesis report.

---

## Table of Contents

1. [Current Codebase Overview](#1-current-codebase-overview)
2. [Grading Rubric Reference](#2-grading-rubric-reference)
3. [Component 1: YouTube Video Metadata (20 pts)](#3-component-1-youtube-video-metadata-20-pts)
4. [Component 2: Visual Evaluation (20 pts)](#4-component-2-visual-evaluation-20-pts)
5. [Component 3: Interview Logic (20 pts)](#5-component-3-interview-logic-20-pts)
6. [Component 4: Final Synthesis (20 pts)](#6-component-4-final-synthesis-20-pts)
7. [Component 5: Final Prompt File (15 pts)](#7-component-5-final-prompt-file-15-pts)
8. [Implementation Checklist](#8-implementation-checklist)
9. [Suggested File and State Structure (Reference)](#9-suggested-file-and-state-structure-reference)
10. [Summary for the AI Agent](#10-summary-for-the-ai-agent)

---

## 1. Current Codebase Overview

The existing app (`app.py`) currently:

- Loads video data from a **static JSON file** (`youtube_data.json`) and uses a dropdown to select a video.
- Displays the selected video via an **iframe** from the JSON.
- Has a **“Start Recording Reaction”** toggle that captures webcam frames at an interval (e.g., every 10 seconds) into an `images/` folder, up to a configurable max (e.g., 20).
- Has an **“Evaluate Response”** button that sends up to 20 images plus a text prompt (from `prompt_reaction.txt`) to **gpt-5-nano** and shows the AI’s reaction summary in plain text.
- Uses **OpenAI** (via `openai` package) and **python-dotenv** for `OPENAI_API_KEY` from `.env`.
- Uses **OpenCV** (`cv2`) for webcam capture.

**What must change:**

- Replace the JSON/dropdown flow with a **single YouTube URL input**. Fetch metadata and transcript programmatically.
- Keep and refine the **visual capture + evaluation** (max 20 images, gpt-5-nano), and **display the visual evaluation in a nicely formatted way**.
- Add a **post-video phase**: “Start Interview” → chatbot whose **system prompt** is injected with **video metadata + visual evaluation**. The AI should reference facial expressions (e.g., “I noticed you smiled at [Time X], what caused that?”).
- Add **“End Chat”** → send **full chat history + video metadata + visual evaluation** to the AI to produce a **final synthesis report**, displayed in a nicely formatted way.
- Ensure the **exact final prompt** used for that synthesis is written to **`final_prompt.txt`**.

---

## 2. Grading Rubric Reference

| Component | Points | Description |
|-----------|--------|-------------|
| YouTube Video Metadata | 20 | Successfully extracts Title, Duration, Description, and Transcript from the live YouTube URL. |
| Visual Evaluation | 20 | Correctly captures up to 20 frames and uses gpt-5-nano to create a visual evaluation. |
| Interview Logic | 20 | “Start Interview” button starts a chatbot that successfully uses the initial evaluation and video metadata within its system prompt. |
| Final Synthesis | 20 | “End Chat” button triggers a coherent report that integrates chat history with visual/video data. The report is displayed in a nicely formatted way. |
| Final Prompt Completeness | 15 | `final_prompt.txt` contains the exact final prompt used in the app and clearly incorporates YouTube video metadata, the visual evaluation, and the chat history, as described in the assignment. |

Implement each section below so that the corresponding grading criterion is clearly satisfied. (Submission packaging and testing are handled separately.)

---

## 3. Component 1: YouTube Video Metadata (20 pts)

### Objective

When the user provides a YouTube URL, the app must **programmatically retrieve** and use:

- **Video Title**
- **Duration** (in seconds)
- **Description**
- **Transcript**

### Implementation Steps

1. **Replace the current video selection UI**
   - Remove the logic that loads `youtube_data.json` and the dropdown of video titles.
   - Add a **text input** (e.g., `st.text_input`) where the user pastes a YouTube URL (e.g., `https://www.youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`).

2. **Parse the video ID** from the URL  
   - Support at least:
     - `https://www.youtube.com/watch?v=VIDEO_ID`
     - `https://youtu.be/VIDEO_ID`  
   - Extract `VIDEO_ID` and use it for all API/library calls.

3. **Fetch metadata (Title, Duration, Description)**
   - Use a library that can get this from a YouTube URL **without requiring the user to provide a YouTube Data API key** (unless the assignment allows it). Recommended:
     - **yt-dlp**: use `yt_dlp.YoutubeDL` with `extract_info(url, download=False)` to get `title`, `duration`, `description`. Add `yt-dlp` to `requirements.txt`.
   - Handle errors (invalid URL, private video, etc.) and show a clear message in the UI (e.g., `st.error`).

4. **Fetch transcript**
   - Use **youtube-transcript-api** (or equivalent) to get the transcript for `VIDEO_ID`. Convert the list of text segments into a single string (e.g., join with spaces or newlines). Add `youtube-transcript-api` to `requirements.txt`.
   - Some videos have no transcript; handle that case (e.g., store empty string or “No transcript available”) and do not crash.

5. **Build the embed URL and iframe**
   - Embed URL format: `https://www.youtube.com/embed/VIDEO_ID`
   - Build the same iframe HTML structure the current app uses (or equivalent) so the video plays in the app.

6. **Store in app state**
   - After a successful fetch, store in `st.session_state` (or equivalent) at least:
     - `title`
     - `duration_seconds` (integer)
     - `description` (string)
     - `transcript` (string)
     - `iframe` (HTML string for embed)
     - Optionally the raw URL and video_id for reuse.

7. **Flow**
   - User enters URL → user triggers “Load” / “Fetch” (or fetch automatically on URL change, with debounce if desired).  
   - On success: show the video (iframe), display title and duration (and optionally description/transcript in an expander).  
   - Only enable “Start Recording Reaction” (and later interview/synthesis) when metadata (and optionally transcript) has been loaded.

**Deliverable:** The app must include an input for a YouTube URL and must programmatically retrieve and display/use Title, Duration, Description, and Transcript so that the grader can verify the 20-point criterion.

---

## 4. Component 2: Visual Evaluation (20 pts)

### Objective

- Use the webcam to capture the user’s reactions while they watch the video.
- Capture and send a **maximum of 20 images** to the AI.
- Use **gpt-5-nano** for the **initial visual evaluation**.
- **Display the visual evaluation in a nicely formatted way** (not just raw plain text).

### Implementation Steps

1. **Keep or adapt existing capture logic**
   - Reuse the current webcam capture flow (e.g., toggle “Start Recording Reaction”, capture frames at an interval into `images/`, filenames like `screen_shot_01.png`, …, up to 20).
   - Ensure the **maximum number of images** sent to the AI is **exactly 20** (or fewer if fewer were captured). The assignment states “a maximum of 20 images.”

2. **Trigger visual evaluation**
   - After the user has watched and the app has captured frames, provide a button (e.g., “Run Visual Evaluation” or “Evaluate Response”) that:
     - Reads up to 20 images from `images/`.
     - Builds a multimodal request: **text prompt + images** (base64 or image_url format as in the current app).
     - Uses **model `gpt-5-nano`** for this step (and for all AI processing per assignment).
   - The text prompt should include at least: video title, duration (seconds), and optionally description/transcript, so the AI can relate reactions to the content. You can keep using a template similar to `prompt_reaction.txt` or inline the prompt in code.

3. **Store the visual evaluation result**
   - Save the model’s response in `st.session_state` (e.g., `visual_evaluation`) so it can be:
     - Shown in the UI in a formatted way.
     - Injected into the **interview system prompt** (Component 3).
     - Included in the **final synthesis** (Component 4).

4. **Display the visual evaluation “in a nicely formatted way”**
   - Do not only use `st.write(evaluation_text)`.
   - Options (implement at least one or a combination):
     - Use **Markdown**: ensure the model’s response uses markdown (e.g., headers, bullet points); render with `st.markdown(visual_evaluation)`.
     - Use **expander**: `st.expander("Visual Evaluation", expanded=True)` and put the content inside.
     - Use **columns/cards**: e.g., a dedicated section with a clear heading and optional sub-sections (e.g., “Emotional reaction”, “Engagement”, “Notable moments”) if the model output is structured.
   - If the prompt asks the model for structured output (e.g., “Completion percent”, “Emotional reaction”, “Engagement level”, “Notable moments”), the displayed text should reflect that structure in a readable way (e.g., via markdown).

**Deliverable:** Up to 20 frames captured, gpt-5-nano used for visual evaluation, and the result displayed in a clearly formatted section so that the 20-point criterion is met.

---

## 5. Component 3: Interview Logic (20 pts)

### Objective

- **After the video ends** (and after the visual evaluation is available), the user can start an interview.
- A **“Start Interview”** button initializes a **chatbot interface**.
- The AI’s **system prompt** must be **injected** with:
  - **Video metadata** (title, duration, description, transcript as needed).
  - **Results of the visual evaluation** (the text produced in Component 2).
- The AI should **ask the user what they liked/disliked** and **reference their facial expressions** (e.g., “I noticed you smiled at [Time X], what caused that?”).

### Implementation Steps

1. **When to show “Start Interview”**
   - Show the “Start Interview” button only when:
     - Video metadata has been loaded (from URL).
     - Visual evaluation has been run and stored (so you have text to inject into the system prompt).
   - Optionally, you can allow “Start Interview” even before the user has watched the full video, but the assignment says “after the video ends”; so at least ensure the visual evaluation exists before starting the interview.

2. **Chatbot UI**
   - Use Streamlit chat: `st.chat_message` and `st.chat_input`, and maintain **chat history** in `st.session_state` (e.g., `st.session_state.messages` as a list of `{"role": "user"|"assistant", "content": "..."}`).
   - When “Start Interview” is clicked:
     - Initialize the chat history (e.g., clear previous interview messages or start fresh).
     - Optionally add a first message from the assistant (e.g., “I’ve reviewed your reaction to [Video Title]. I’d like to ask you a few questions…”).
     - Do **not** include the full chat history in the system prompt for each turn; only the **system prompt** is injected with metadata + visual evaluation. The **conversation** is sent as separate user/assistant messages.

3. **System prompt content**
   - Build a **system** message (or system prompt string) that includes:
     - **Video metadata**: title, duration in seconds, short description (and optionally transcript or a summary).
     - **Visual evaluation**: the full text of the visual evaluation from Component 2.
     - **Instructions** for the AI, for example:
       - You are an interviewer following the user’s viewing of the video.
       - Ask what they liked and disliked.
       - Reference specific moments from the **visual evaluation** (e.g., “I noticed you smiled around [time or image number]”; “Your expressions suggested surprise at one point—what was that about?”).
       - Keep the conversation natural and concise.

4. **Sending messages to gpt-5-nano**
   - For each user message in the chat:
     - Call the OpenAI API with `model="gpt-5-nano"`.
     - Send:
       - One **system** message with the injected prompt (video metadata + visual evaluation + interviewer instructions).
       - The full **chat history** (all previous user and assistant messages) so the model has context.
     - Append the new assistant reply to `st.session_state.messages` and display it in the chat.

5. **“End Chat”**
   - Add an **“End Chat”** button (see Component 4). When clicked, the app should:
     - Stop the interview (e.g., disable chat input or hide it).
     - Trigger the **Final Synthesis** flow (Component 4).

**Deliverable:** “Start Interview” starts a chatbot that uses the initial visual evaluation and video metadata in its system prompt and that can reference the user’s facial expressions. This satisfies the 20-point criterion.

---

## 6. Component 4: Final Synthesis (20 pts)

### Objective

- When the user clicks **“End Chat”**, the app must:
  - Send to the AI: **full chat history**, **video metadata**, and **visual evaluation**.
  - The AI produces a **final summary** of how the user truly felt about the content.
  - The report must be **displayed in a nicely formatted way**.
  - The **exact prompt** used for this step must be saved to **`final_prompt.txt`** (see Component 5).

### Implementation Steps

1. **“End Chat” button**
   - Place “End Chat” in the interview section. When clicked:
     - Set a flag or state (e.g., `st.session_state.interview_ended = True`) so the chat input is disabled or hidden.
     - Trigger the **final synthesis** API call (see below).
     - Do not clear the chat history; it is needed for the prompt and for `final_prompt.txt`.

2. **Build the final synthesis prompt**
   - Construct a **single prompt** (or a structured prompt with clear sections) that includes:
     - **YouTube video metadata**: title, duration (seconds), description, and transcript (or a note that transcript was not available).
     - **Visual evaluation**: the full text of the visual evaluation from Component 2.
     - **Chat history**: the full conversation (all user and assistant messages in order), formatted clearly (e.g., “User: … Assistant: …” or “Role: … Content: …”).
   - Add **instructions** for the model, for example:
     - “Based on the video metadata, the visual reaction analysis, and the following interview, write a final comprehensive sentiment report on how the user truly felt about the content. Include: overall sentiment, alignment between facial expressions and stated opinions, key moments they mentioned, and any surprises or contradictions.”
   - This exact prompt (the full text sent to the model in this step) must be written to **`final_prompt.txt`** (see Component 5). If the API accepts a system message and a user message, the “prompt” for the file should be the complete set of instructions + metadata + visual evaluation + chat history that the model sees (you can concatenate system + user content into one document for `final_prompt.txt`).

3. **Call the API**
   - Use **gpt-5-nano**.
   - Send the constructed prompt (and optionally a system message) so the model has all context.
   - Store the model’s response (e.g., `st.session_state.final_report`).

4. **Write `final_prompt.txt`**
   - **Before or immediately after** calling the API, write to **`final_prompt.txt`** the **exact** final prompt used for this synthesis (the text that contains video metadata, visual evaluation, and chat history). Use UTF-8 encoding. See Component 5 for details.

5. **Display the report “in a nicely formatted way”**
   - Do not use only `st.write(report_text)`.
   - Use at least one of:
     - **Markdown**: `st.markdown(st.session_state.final_report)` so headers, lists, and emphasis are rendered.
     - **Expander or dedicated section**: e.g., “Final Synthesis Report” with a clear heading and the report inside.
     - **Structured layout**: if the model is instructed to output sections (e.g., “Overall sentiment”, “Key moments”, “Contradictions”), consider rendering with subheaders or columns.
   - The grader should see a clear, readable report that integrates chat history with visual and video data.

**Deliverable:** “End Chat” triggers a coherent final report that integrates chat history with visual and video data, displayed in a nicely formatted way, satisfying the 20-point criterion.

---

## 7. Component 5: Final Prompt File (15 pts)

### Objective

- The file **`final_prompt.txt`** must contain the **exact final prompt** used to generate the **Final Synthesis Report** in the app.
- The prompt must **clearly incorporate**:
  - **YouTube video metadata** (title, duration, description, transcript).
  - **Visual evaluation** (the AI’s initial reaction analysis text).
  - **Chat history** (the full interview conversation).

### Implementation Steps

1. **When to write the file**
   - When the user clicks “End Chat” and the app builds the prompt for the final synthesis API call, **immediately before** (or right after) sending the request, write to **`final_prompt.txt`** the **exact** string that the model receives for that call.
   - If you use a “system” message and a “user” message, combine them into one document (e.g., “=== SYSTEM ===\n…\n=== USER ===\n…”) so the file represents the full prompt. The grader should see everything the model was given to produce the report.

2. **Content of `final_prompt.txt`**
   - Include:
     - All instructions given to the model for the final synthesis.
     - The full video metadata (title, duration, description, transcript).
     - The full visual evaluation text.
     - The full chat history (every user and assistant message in order).
   - Use UTF-8 encoding when writing the file.
   - Do not truncate or summarize; the file must match what the app actually sends to the API (so that whenever the app runs "End Chat," the file reflects the exact prompt used for that run).

3. **Location**
   - Write `final_prompt.txt` in the **project root** (same directory as `app.py`) or in a known path.


**Deliverable:** `final_prompt.txt` exists and contains the exact final prompt used in the app, clearly incorporating YouTube video metadata, the visual evaluation, and the chat history.

---

## 8. Implementation Checklist

Use this checklist to verify that all required behavior is implemented (testing is done manually):

- [ ] **YouTube metadata:** Input box for URL; Title, Duration, Description, Transcript are fetched and used.
- [ ] **Visual evaluation:** Up to 20 images captured; gpt-5-nano used; result displayed in a nicely formatted way.
- [ ] **Interview:** "Start Interview" starts a chatbot; system prompt includes video metadata + visual evaluation; AI can reference facial expressions.
- [ ] **Final synthesis:** "End Chat" runs final report; report uses chat history + metadata + visual evaluation; report displayed in a nicely formatted way.
- [ ] **final_prompt.txt:** Exact final synthesis prompt (including metadata, visual evaluation, chat history) is written to `final_prompt.txt`.
- [ ] **requirements.txt:** Includes Streamlit, OpenCV, python-dotenv, openai, and YouTube-related libraries so the app runs correctly.

---

## 9. Suggested File and State Structure (Reference)

- **`app.py`**
  - Config: `MODEL = "gpt-5-nano"`, `MAX_IMAGES = 20`, `IMAGES_DIR = "images"`, etc.
  - Helper: extract video ID from URL.
  - Helper: fetch metadata (yt-dlp) and transcript (youtube-transcript-api); return dict with title, duration_seconds, description, transcript, embed_url/iframe.
  - Helper: run visual evaluation (load images, build multimodal prompt, call gpt-5-nano, return text).
  - Helper: build interview system prompt (metadata + visual evaluation + instructions).
  - Helper: build final synthesis prompt (metadata + visual evaluation + chat history + instructions); call gpt-5-nano; write exact prompt to `final_prompt.txt`; return report text.
  - UI: URL input → Fetch → show video + metadata; “Start Recording” → capture; “Evaluate” → visual evaluation (formatted); “Start Interview” → chat; “End Chat” → final synthesis (formatted) + write `final_prompt.txt`.

- **`st.session_state` (suggested keys)**
  - `video_metadata` (dict: title, duration_seconds, description, transcript, iframe).
  - `visual_evaluation` (str).
  - `messages` (list of {role, content} for chat).
  - `final_report` (str).
  - `interview_started`, `interview_ended` (booleans) if needed for flow control.

---

## 10. Summary for the AI Agent

1. Replace JSON/dropdown with **YouTube URL input** and fetch **Title, Duration, Description, Transcript** (e.g., yt-dlp + youtube-transcript-api).
2. Keep **webcam capture** (max 20 images) and **gpt-5-nano** for **visual evaluation**; **display result in a nicely formatted way** (e.g., markdown, expander).
3. Add **“Start Interview”** → chatbot with **system prompt** = video metadata + visual evaluation; AI references facial expressions.
4. Add **“End Chat”** → build **final synthesis prompt** (metadata + visual evaluation + full chat history) → call gpt-5-nano → **write exact prompt to `final_prompt.txt`** → **display report in a nicely formatted way**.
5. **requirements.txt** must include YouTube libraries so the app runs correctly.

Following this guide should satisfy the implementation criteria; testing and any submission packaging are done separately.
