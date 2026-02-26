# YouTube AI Chat Assistant — Implementation Plan

This document is a detailed, agent-ready plan to add all required features to the HW_5 chat app so it becomes a **YouTube AI Chat Assistant**. It is aligned with the assignment instructions and the grading rubric (image provided).

---

## Current State Summary

- **Auth**: Create Account has Username, Email, Password only. Login returns `{ username }`. No first/last name.
- **App**: Single view after login — `Chat` only. No tabs; no "YouTube Channel Download" page.
- **Chat**: Supports CSV drag-and-drop and images; uses `streamChat` (search/code execution) and `chatWithCsvTools` with CSV-specific tools (`compute_column_stats`, `get_value_counts`, `get_top_tweets`). Renders `EngagementChart` for tool charts. No JSON file support.
- **Backend**: Express + MongoDB. Users collection: `username`, `password`, `email`. Sessions/messages support `imageData`, `charts`, `toolCalls`. No first/last name; no YouTube or image-generation endpoints.
- **Prompt**: `public/prompt_chat.txt` is Lisa/TA persona with CSV tools and engagement column. No YouTube assistant framing, no JSON, no new tool names.
- **Tools**: Only CSV tools in `src/services/csvTools.js`. Gemini uses `CODE_EXEC_TOOL` or `SEARCH_TOOL` in `gemini.js`; CSV path uses `chatWithCsvTools` with `CSV_TOOL_DECLARATIONS`. No `generateImage`, `plot_metric_vs_time`, `play_video`, or `compute_stats_json`.

Use this plan as a step-by-step checklist for the next agent (or developer). Each section maps to a grading component and includes files to touch and concrete implementation steps.

---

## 1. Chat Personalization (10 pts)

**Requirement:** First Name and Last Name in Create Account form, saved in DB, used in chat context, and system prompt updated so the AI addresses the user by name in the first message.

### 1.1 Database and API

- **File: `server/index.js`**
  - **POST `/api/users`**: Accept `firstName` and `lastName` in `req.body`. Validate (e.g. non-empty strings, max length). Store in the same document as `firstName`, `lastName` (e.g. `String(...).trim()`).
  - **POST `/api/users/login`**: In the success response, include the user’s `firstName` and `lastName` from the DB (e.g. `res.json({ ok: true, username: name, firstName: user.firstName, lastName: user.lastName })`). Ensure existing users without these fields still work (use `user.firstName ?? ''` etc.).

### 1.2 Frontend Auth and User State

- **File: `src/components/Auth.js`**
  - Add state: `firstName`, `lastName`.
  - In Create Account mode, add two inputs: "First Name" and "Last Name" (required in create mode).
  - On create submit, call the API with `username`, `password`, `email`, `firstName`, `lastName`.
  - On login success, call `onLogin(user)` where `user` includes `username`, `firstName`, `lastName` (from API response).

- **File: `src/services/mongoApi.js`**
  - `createUser(username, password, email, firstName, lastName)`: send `firstName`, `lastName` in the POST body.
  - `findUser(username, password)`: return the full user object from login API, e.g. `{ username, firstName, lastName }` (so Chat and App can use names).

### 1.3 Persist and Pass User to Chat

- **File: `src/App.js`**
  - Store the full user object (or at least `username`, `firstName`, `lastName`) when logging in. Options:
    - Store `user` in state and persist to localStorage as JSON (e.g. `chatapp_user` = `JSON.stringify({ username, firstName, lastName })`), and on init read it back and set state so Chat receives names even after refresh.
  - Pass to Chat: `user` (or `username`, `firstName`, `lastName`) and `onLogout`. Chat should receive first and last name for context and display.

### 1.4 Chat Context and First-Message Greeting

- **File: `src/components/Chat.js`**
  - Change props from `username` to accept `user` (or `username`, `firstName`, `lastName`). Use a display name: e.g. `firstName && lastName ? \`${firstName} ${lastName}\`` : `username`; use that for sidebar and message meta if desired.
  - When building the **system prompt or the first user message** that injects context (see 1.5), include the user’s name so the AI knows who it is talking to. Example: "The user you are talking to is [First Name] [Last Name]." or "Address the user by name: [First Name]."

### 1.5 System Prompt (name in first message)

- **File: `public/prompt_chat.txt`**
  - In the prompt engineering section (Section 8 below), the instructions will state that the AI is a YouTube analysis assistant and should address the user by name. The **runtime** must inject the actual name into the prompt. So either:
    - **Option A**: In `gemini.js`, when loading the system prompt, append a line like: "The current user is [firstName] [lastName]. In your first response, greet them by name (e.g. Hi [FirstName])." and pass `firstName`/`lastName` into the function that builds the system instruction, **or**
    - **Option B**: Prepend this to the very first user message in the chat when no history exists: "You are speaking to [FirstName] [LastName]." so the model sees it once.
  - Ensure the model is instructed to use the user’s name in the first message (e.g. "Always greet the user by their first name in your first message.").

**Verification:** Create account with first/last name, log in, open chat, confirm DB has first/last name and the first AI message uses the user’s name.

---

## 2. YouTube Channel Data Download Tab (20 pts)

**Requirement:** A tab "YouTube Channel Download" with URL input, max videos input (default 10, max 100), Download button, progress bar, and ability to download the resulting JSON. Also: download 10 videos from `https://www.youtube.com/@veritasium` and save the JSON in `public/` so the grader can verify.

### 2.1 Backend: YouTube Data Fetching

- **Approach:** YouTube Data API v3 is the standard way. You will need an API key (create in Google Cloud Console, enable YouTube Data API v3). Alternatively, a server-side scraper could be used (higher risk of breakage; not recommended for grading).
- **File: `server/index.js`** (or a new `server/youtube.js` required from `index.js`)
  - Add an endpoint, e.g. **GET or POST `/api/youtube/channel`** (or `/api/youtube/download`), that:
    - Accepts `channelUrl` (or channel ID) and `maxVideos` (default 10, cap 100).
    - Resolves the channel ID from the URL if needed (e.g. `@veritasium` → channel ID via API).
    - Uses the YouTube Data API to:
      - Get uploads playlist ID for the channel.
      - Get video IDs from the playlist (up to `maxVideos`).
      - For each video: get snippet + contentDetails + statistics (title, description, publishedAt, duration, viewCount, likeCount, commentCount, video URL). Optionally add transcript if you use a transcript API (e.g. YouTube Transcript API or similar) — assignment says "transcript (if available)".
    - Returns a JSON array of video objects. Structure example: `{ channelId, channelTitle, videos: [ { videoId, title, description, publishedAt, duration, viewCount, likeCount, commentCount, url } ] }`.
  - Use environment variable for the YouTube API key (e.g. `YOUTUBE_API_KEY` or `REACT_APP_YOUTUBE_API_KEY` if the client must pass it; prefer server-only key).
  - **Progress:** Progress bar is easiest implemented on the client by polling or by a streaming/SSE endpoint. Simpler approach: server does the full fetch and returns when done; client shows an indeterminate or step-based progress (e.g. "Fetching channel…", "Fetching videos 1–10…") or a single progress value if you add a simple progress callback (e.g. WebSocket or SSE sending progress 0–100). Alternatively, implement a **streaming endpoint** that sends progress events (e.g. "10", "20", … "100") so the client can update a progress bar.

### 2.2 Frontend: New Tab and Page

- **File: `src/App.js`**
  - After login, show a tab bar or navigation: e.g. "Chat" and "YouTube Channel Download". Use state like `activeTab: 'chat' | 'youtube'` and render either `<Chat ... />` or `<YouTubeChannelDownload ... />`.

- **New file: `src/components/YouTubeChannelDownload.js`** (or `YouTubeChannelDownload.jsx`)
  - UI:
    - Input: "Channel URL" (e.g. `https://www.youtube.com/@veritasium`).
    - Input: "Max videos" (number, default 10, max 100).
    - Button: "Download Channel Data".
  - On submit: call the backend endpoint with channel URL and max videos. While waiting, show a **progress bar** (either determinate from server progress or indeterminate/spinner).
  - On success: store the JSON in component state (and optionally in a ref or global state so it can be referenced for "download file").
  - **Download JSON**: Provide a button or link to download the current result as a file (e.g. `data.json` or `channel-data.json`). Use a blob + temporary anchor with `download` attribute, or a data URL.
  - Optional: show a short preview (e.g. first 3 video titles) and the count of videos.

### 2.3 Pre-downloaded Sample for Grader

- **File: `public/veritasium-channel-10.json`** (or similar name)
  - Run the download once for `https://www.youtube.com/@veritasium` with max 10 videos. Save the response JSON into this file in `public/`. This proves the feature works and gives the grader a ready-made file. Document in README or in the plan that this file is the expected output of the download feature.

**Verification:** Open "YouTube Channel Download" tab, enter @veritasium URL and 10 videos, click download, see progress bar, then download the JSON. Confirm `public/veritasium-channel-10.json` exists and has the required fields.

---

## 3. JSON Chat Input (10 pts)

**Requirement:** User can drag-and-drop a JSON file into the chat; it loads into the conversation context and is available for code execution. Describe this in `public/prompt_chat.txt`.

### 3.1 Chat: Accept JSON Files

- **File: `src/components/Chat.js`**
  - Extend file handling (drag-and-drop and file picker) to accept `.json` files in addition to CSV and images.
  - When a JSON file is dropped or selected:
    - Read as text, then `JSON.parse`. If parsing fails, show a short error (e.g. "Invalid JSON") and do not set context.
    - Store in state analogous to CSV: e.g. `jsonContext: { name, data, parsed }` and optionally `sessionJsonData` / `sessionJsonRows` if you want to treat it like an array of objects for tools (see Section 7). Keep the raw JSON (or a stringified version) so it can be injected into the prompt and/or passed to code execution.
  - Show a chip or badge in the input area when a JSON file is attached (e.g. "📄 channel-data.json" with remove button).
  - In the message payload sent to the model, include the JSON (or a summary + excerpt) in the user message or in a system-like prefix so the AI and tools can use it. Avoid sending huge payloads: e.g. if JSON is large, send a summary (e.g. "Array of N videos with keys: title, viewCount, ...") plus the full data reference for tool use (e.g. `sessionJsonData` in the client for `compute_stats_json` and `plot_metric_vs_time`).

### 3.2 Persist JSON in Session (for code execution)

- **File: `src/components/Chat.js`**
  - When the user sends a message with a JSON file attached, the JSON must be "saved locally" in the sense that the current session has access to it for the rest of the conversation. So keep `sessionJsonData` (or similar) in React state for the session and pass it to:
    - The prompt builder (so the AI knows what’s in the data), and
    - Any tool executors that need to run on the JSON (e.g. `compute_stats_json`, `plot_metric_vs_time`, `play_video`).
  - For **code execution** (Python): if the app sends the JSON to Gemini for code execution, include it in the user message in a way Gemini can use (e.g. "The user has attached the following JSON data:\n```json\n...\n```"). Truncate if over token limits; or pass a variable in the code execution context if the API supports it. The assignment says "available for code execution" — so at least one path (tool or code) must be able to use the JSON; tools are the primary path.

### 3.3 Prompt

- **File: `public/prompt_chat.txt`**
  - In the section that describes input (see Section 8), add: users can drag-and-drop a JSON file into the chat; it loads into the conversation context and is available for analysis and for the chat tools (and code execution if applicable). The AI should use the tools when the user asks for stats, plots, or video playback based on that JSON.

**Verification:** Drag a channel JSON file into chat; see chip; send "What's in this file?" and confirm the AI describes it; ask for stats or a plot and confirm tools/code can use the data.

---

## 4. Chat Tool: `generateImage` (10 pts)

**Requirement:** Image generation from a text prompt and an anchor image; display in chat with download and lightbox on click. Described in `prompt_chat.txt`.

### 4.1 Backend / API for Image Generation

- **Option A — Gemini Imagen:** If using Gemini’s image generation (e.g. `gemini-2.0-flash-exp` or a model with imagen), the generation can be done from the **client** via the same Gemini SDK (if the key is on the client) or from the **server** to keep the key server-side. The assignment says "based on a text prompt and an anchor image" — so the flow is: user provides text prompt + one image; the model generates a new image. Check current Gemini API for "edit image" or "generate image from prompt + reference image" and implement one endpoint or one client call that returns the generated image bytes (or base64).
- **Option B — External service:** Use an external image-generation API (e.g. DALL·E, Stability, Replicate) with prompt + reference image. Then the server would need to call that API and return the image to the client.
- **Implementation:** Prefer doing this via a **server route** (e.g. POST `/api/generate-image`) that accepts `{ prompt, imageBase64, mimeType }`, calls the chosen image API, and returns the generated image (e.g. base64 or URL). This keeps API keys off the client.

### 4.2 Tool Declaration and Execution

- **New or existing file for YouTube/chat tools:** e.g. `src/services/chatTools.js` or extend `gemini.js`.
  - Define a **function declaration** for `generateImage` with parameters, e.g.:
    - `prompt` (string): text description for generation.
    - `anchorImage` (or handled implicitly): in practice the "anchor image" is the image the user attached to the message. So the tool might only take `prompt` and the runtime passes the attached image from the current message.
  - The actual execution can be:
    - **Server:** Client sends the tool call (prompt + anchor image) to the server; server calls the image API and returns the generated image to the client.
    - **Client:** If using Gemini from the client, after receiving a `functionCall` for `generateImage`, the client sends the prompt and the anchor image to the server (or Gemini) and gets back the image, then displays it and returns the result (e.g. image URL or "Image generated and displayed") to the model in a function response.

### 4.3 Chat UI: Tool Choice and Routing

- **File: `src/services/gemini.js`**
  - You will need a **unified chat path** that can use both CSV-style tools and the new YouTube tools. Options:
    - **Single tool list:** Add `generateImage`, `plot_metric_vs_time`, `play_video`, `compute_stats_json` to a shared `FUNCTION_DECLARATIONS` array and use one `chatWithTools(history, message, executeFn)` that supports both CSV and YouTube tools. The `executeFn` on the client will route by tool name to the right implementation (e.g. call `/api/generate-image` for `generateImage`, or run local logic for stats/plot/play_video).
  - Ensure when the user has attached an image and asks to "generate an image" or similar, the model can call `generateImage` with the prompt and the anchor image is available (e.g. in the message parts or in context).

### 4.4 Display, Download, and Lightbox

- **File: `src/components/Chat.js`**
  - When a model message contains a tool result from `generateImage` (e.g. an image URL or base64), render it in the message bubble (same way as `part.type === 'image'` or a new type `generatedImage`).
  - **Download:** Add a button or link "Download" next to the image that triggers a download of the image file (e.g. from base64 or URL).
  - **Lightbox:** On click of the image, open a lightbox (modal/overlay) showing the enlarged image with a close button. You can use a simple state like `lightboxImage: urlOrBase64 | null` and a modal div; or a small library.

### 4.5 Prompt

- **File: `public/prompt_chat.txt`**
  - Document: **generateImage** — generates an image from a text prompt and an anchor/reference image provided by the user. Use it when the user asks to create, edit, or generate an image based on a description and an uploaded image.

**Verification:** Attach an image, ask "Generate an image that makes this look like a painting." Confirm the tool is called, the image appears in the chat, can be downloaded, and clicking it opens a lightbox.

---

## 5. Chat Tool: `plot_metric_vs_time` (15 pts)

**Requirement:** Plot any numeric field (views, likes, comments, etc.) vs time for channel videos; React component in the chat; enlarge and download. Described in `prompt_chat.txt`.

### 5.1 Tool Declaration and Execution

- **File: `src/services/chatTools.js` (or equivalent)**
  - Declare a function `plot_metric_vs_time` with parameters, e.g.:
    - `metric` (string): field name to plot on y-axis (e.g. `view_count`, `like_count`, `comment_count`). Must match a numeric field in the channel JSON.
    - Optionally `timeField` (string): field for x-axis (default e.g. `published_at` or `release_date`).
  - Executor: given the session’s channel JSON (array of videos), extract the chosen metric and time field, sort by time, and return a payload that the frontend can use to render a chart. Same pattern as `EngagementChart` and the CSV chart tool: return something like `{ _chartType: 'metric_vs_time', data: [...], metric, timeField }` so the UI can render it.

### 5.2 React Chart Component

- **New file: `src/components/MetricVsTimeChart.js`**
  - Props: `data` (array of { date/time, value } or { x, y }), `metric` (label), optionally `timeField`.
  - Use **Recharts** (already in package.json) to render a line or bar chart (e.g. `LineChart` or `BarChart`) with time on X-axis and metric on Y-axis. Match the style of `EngagementChart` (colors, tooltip, responsive container).
  - Support **enlarge:** when the user clicks the chart, show it in a modal/lightbox (same pattern as image lightbox) with a larger size.
  - Support **download:** in the lightbox or next to the chart, a "Download" button that exports the chart as PNG (e.g. use `html2canvas` or Recharts’ export, or a simple canvas-based export). If no library is added, document "Download as PNG" and implement with a small utility or leave a TODO with a clear comment.

### 5.3 Chat Rendering

- **File: `src/components/Chat.js`**
  - In the message render loop, when a tool result has `_chartType === 'metric_vs_time'`, render `<MetricVsTimeChart ... />` with the returned `data` and `metric`.
  - Ensure the chart is inside the message bubble and the enlarge/download behavior is wired.

### 5.4 Prompt

- **File: `public/prompt_chat.txt`**
  - Document: **plot_metric_vs_time** — plots a numeric field (e.g. view_count, like_count, comment_count) vs time (e.g. publish date) for the videos in the loaded channel JSON. Call it when the user asks for a time series or trend of a metric over time.

**Verification:** Load channel JSON, ask "Plot views over time." Confirm the chart appears, is a React component, and has enlarge + download.

---

## 6. Chat Tool: `play_video` (15 pts)

**Requirement:** Show video title and thumbnail; clicking opens the video in a new tab. User can specify video by title (e.g. "play the asbestos video"), ordinal (e.g. "first video"), or "most viewed". Described in `prompt_chat.txt`.

### 6.1 Tool Declaration and Execution

- **File: `src/services/chatTools.js`**
  - Declare `play_video` with parameters that allow the model to specify which video, e.g.:
    - `selector` (string): one of `"by_title"`, `"by_ordinal"`, `"most_viewed"` (or similar).
    - `titleKeyword` (string, optional): for `by_title`, a keyword or phrase from the title (e.g. "asbestos").
    - `ordinal` (number, optional): for `by_ordinal`, 1-based index (e.g. 1 = first).
    - Alternatively: a single parameter `query` (string) and the executor parses intent (e.g. "first" → ordinal 1, "most viewed" → sort by view count, "asbestos" → search in title).
  - Executor: given `sessionJsonData` (channel videos array), resolve the selected video:
    - `most_viewed`: sort by view count, take first; return `{ videoId, title, thumbnailUrl, url }`.
    - `by_ordinal`: take the Nth video (by some order, e.g. publish date); return same shape.
    - `by_title`: find a video whose title contains the keyword (case-insensitive); return same shape.
  - Thumbnail: YouTube thumbnails are typically `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` or `/mqdefault.jpg`. Include in the return so the UI can show it.

### 6.2 Chat UI: Video Card

- **File: `src/components/Chat.js`** (or a small **`VideoCard.js`** component)
  - When a tool result is from `play_video`, render a card showing:
    - Thumbnail (img), title (e.g. below or overlay).
    - Clicking the card (or a "Play" button) opens `video.url` (YouTube watch URL) in a new tab (`window.open(url, '_blank')`).

### 6.3 Prompt

- **File: `public/prompt_chat.txt`**
  - Document: **play_video** — plays or opens a YouTube video from the loaded channel data. The user can ask by title (e.g. "play the asbestos video"), by position (e.g. "play the first video"), or by "most viewed". The tool returns the video’s title and thumbnail; the app shows a clickable card that opens the video in a new tab.

**Verification:** Load channel JSON, ask "Play the most viewed video" and "Play the asbestos video"; confirm cards appear and open the correct video in a new tab.

---

## 7. Chat Tool: `compute_stats_json` (10 pts)

**Requirement:** Compute mean, median, std, min, max for any numeric field in the channel JSON. Described in `prompt_chat.txt`.

### 7.1 Tool Declaration and Execution

- **File: `src/services/chatTools.js`**
  - Declare `compute_stats_json` with parameter e.g. `field` (string): the numeric field name (e.g. `view_count`, `like_count`, `comment_count`, `duration`). Use the exact names that appear in the channel JSON (document in the description).
  - Executor: given `sessionJsonData`, extract the numeric values for that field (handle duration if stored as "PT1M30S" — convert to seconds or a number). Compute mean, median, standard deviation, min, max (reuse logic similar to `compute_column_stats` in `csvTools.js`). Return a plain object: `{ field, mean, median, std, min, max, count }`.

### 7.2 Integration with Chat

- **File: `src/components/Chat.js`**
  - When the AI calls `compute_stats_json`, the executor runs on `sessionJsonData`. The model’s reply will typically summarize the result in text; no special UI is required beyond the tool result being available to the model. Optionally you can render a small summary card (e.g. "view_count: mean=..., median=...") in the message.

### 7.3 Prompt

- **File: `public/prompt_chat.txt`**
  - Document: **compute_stats_json** — computes mean, median, standard deviation, minimum, and maximum for a numeric field in the loaded channel JSON (e.g. view_count, like_count, comment_count, duration). Use it when the user asks for statistics, average, or distribution of a numeric column.

**Verification:** Load channel JSON, ask "What’s the average view count?" or "Give me stats for like_count"; confirm the tool is called and the AI responds with correct numbers.

---

## 8. Prompt Engineering (5 pts)

**Requirement:** System prompt in `public/prompt_chat.txt` clearly states: the AI is a YouTube analysis assistant; it will receive JSON files of channel data; it has tools to analyze data and generate content.

### 8.1 Rewrite `public/prompt_chat.txt`

- **File: `public/prompt_chat.txt`**
  - **Identity:** You are a **YouTube analysis assistant** (replace or complement the current Lisa/TA persona as required by the assignment). The assistant helps users analyze YouTube channel data and generate content.
  - **Input:** Explain that users can:
    - Upload/drag-and-drop **JSON files** containing YouTube channel/video data (e.g. from the YouTube Channel Download tab). The JSON is loaded into the conversation context and is available for analysis and for the chat tools (and code execution if applicable).
    - Optionally keep or simplify CSV/image support if you want to retain existing behavior; the rubric focuses on JSON and YouTube.
  - **Tools:** List and describe each tool with its **exact name** (for grading):
    - **generateImage** — image generation from a text prompt and an anchor image; describe purpose and when to use.
    - **plot_metric_vs_time** — plot any numeric field vs time for channel videos; describe purpose and when to use.
    - **play_video** — play/open a video from channel data by title, ordinal, or "most viewed"; show title and thumbnail; click opens in new tab; describe in prompt.
    - **compute_stats_json** — mean, median, std, min, max for any numeric field in the channel JSON; describe when to use (stats, average, distribution).
  - **Behavior:** The AI should use these tools when the user asks for analysis, plots, playback, or image generation. Address the user by name in the first message (see Section 1).

**Verification:** Read the prompt file and confirm it clearly states YouTube assistant, JSON input, and all four tools by name with descriptions.

---

## Implementation Order Recommendation

1. **Chat personalization** (Section 1) — DB, API, Auth form, App user state, Chat context, prompt name injection.
2. **Prompt engineering** (Section 8) — Rewrite `prompt_chat.txt` for YouTube assistant and all tools (so the model knows the tool names and when to use them).
3. **JSON chat input** (Section 3) — Drag-and-drop JSON, state, prompt mention.
4. **YouTube Channel Download tab** (Section 2) — Backend endpoint, new tab in App, `YouTubeChannelDownload` component, progress bar, download JSON; create `public/veritasium-channel-10.json`.
5. **compute_stats_json** (Section 7) — Easiest tool; declare, implement, wire to session JSON, add to prompt.
6. **play_video** (Section 6) — Declare, implement selector logic, VideoCard UI.
7. **plot_metric_vs_time** (Section 5) — Declare, implement, MetricVsTimeChart component, enlarge/download.
8. **generateImage** (Section 4) — API choice, server route, tool declaration, Chat display + download + lightbox.
9. **Unified tool routing in Gemini** — Ensure one chat path uses all tools (CSV tools can remain for CSV; when JSON is loaded, use the new tools). Function-calling loop in `gemini.js` (or a new `chatWithYouTubeTools`) that includes all four tool declarations and routes execution to the right place (client-side for stats/plot/play_video; server for generateImage if applicable).

---

## File Change Summary

| Area | Files to Create | Files to Modify |
|------|------------------|------------------|
| Auth & user | — | `server/index.js`, `src/components/Auth.js`, `src/services/mongoApi.js`, `src/App.js` |
| Chat context / name | — | `src/components/Chat.js`, `src/services/gemini.js` (if injecting name into prompt) |
| YouTube tab | `src/components/YouTubeChannelDownload.js` | `src/App.js`, `server/index.js` (YouTube API) |
| Sample data | `public/veritasium-channel-10.json` | — |
| JSON input | — | `src/components/Chat.js`, `public/prompt_chat.txt` |
| Tools | `src/services/chatTools.js`, `src/components/MetricVsTimeChart.js`, optional `VideoCard.js` | `src/services/gemini.js`, `src/components/Chat.js` |
| generateImage | Optional `server/routes/image.js` or in `server/index.js` | `src/components/Chat.js` (display, download, lightbox) |
| Prompt | — | `public/prompt_chat.txt` |

---

## Grading Rubric Quick Reference

| Component | Points | Key requirement |
|-----------|--------|------------------|
| Chat personalization | 10 | First/Last name in form, DB, chat context, AI uses name in first message |
| YouTube Channel Download tab | 20 | Tab with URL, max videos, progress bar, download JSON; 10-video sample in public/ |
| JSON chat input | 10 | Drag-and-drop JSON into chat, load into context, available for tools/code; in prompt_chat.txt |
| generateImage | 10 | Works; display in chat + download + lightbox; in prompt_chat.txt |
| plot_metric_vs_time | 15 | Works with channel JSON; React chart; enlarge + download; in prompt_chat.txt |
| play_video | 15 | Title + thumbnail card; click opens new tab; by title/ordinal/most viewed; in prompt_chat.txt |
| compute_stats_json | 10 | Mean, median, std, min, max for numeric fields; in prompt_chat.txt |
| Prompt engineering | 5 | System prompt: YouTube assistant, JSON input, tools described |

This plan is intended to be handed off to the next agent or developer to implement the YouTube AI Chat Assistant end-to-end without ambiguity.
