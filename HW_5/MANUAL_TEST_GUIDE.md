# Manual Test Guide — YouTube AI Chat Assistant

Use this checklist when the app is running (e.g. `npm run server` in one terminal, `npm run client` in another; frontend at http://localhost:3000).

---

## 1. Chat personalization (10 pts)

- **Create account with name**
  - Switch to "Create an account".
  - Fill: First Name, Last Name, Username, Email, Password.
  - Submit. You should be able to log in afterward.
- **Log in**
  - Log in with that username/password.
- **Check chat uses your name**
  - Open a new chat (or the first chat after login).
  - Check: Does the **first AI message greet you by your first (or full) name?**
  - Check: Does the sidebar or message meta show your name (or username)?
- **DB check (optional)**  
  In MongoDB, the user document should have `firstName` and `lastName` (in addition to username, password, email).

---

## 2. YouTube Channel Download tab (20 pts)

- **Open the tab**
  - After login, find navigation/tabs. Click **"YouTube Channel Download"** (or equivalent).
- **UI**
  - There is a **Channel URL** input (e.g. `https://www.youtube.com/@veritasium`).
  - There is a **Max videos** input (default 10, max 100).
  - There is a **Download Channel Data** (or similar) button.
- **Run a download**
  - Enter: `https://www.youtube.com/@veritasium` and max videos `10`.
  - Click the download button.
  - A **progress bar** (or spinner) should appear while the request runs.
  - When done, the page should show the result (e.g. list/preview of videos or a success state).
- **Download JSON**
  - Use the **Download JSON** (or similar) control to save the result as a file.
  - Open the file: it should be valid JSON with a structure like `channelId`, `channelTitle`, `videos: [ { videoId, title, description, publishedAt, duration, viewCount, likeCount, commentCount, url } ]`.
- **Sample file for grader**
  - Confirm `public/veritasium-channel-10.json` exists and contains 10 videos with the required fields (title, description, duration, release date, view count, like count, comment count, video URL; transcript if implemented).

---

## 3. JSON chat input (10 pts)

- **Attach JSON in chat**
  - Go to the **Chat** tab.
  - Drag and drop the file `public/veritasium-channel-10.json` onto the chat area (or use the attach button and select it).
  - A **chip/badge** should appear (e.g. "📄 veritasium-channel-10.json") indicating the file is attached.
- **Send a message**
  - Type something like: "What's in this file?" or "Summarize this data."
  - Send. The AI should respond using the **content of the JSON** (e.g. mention Veritasium, video titles, or structure).
- **Tools/code on JSON**
  - With the same JSON still in context (or re-attach it), ask: "What's the average view count?" or "Plot views over time" or "Play the asbestos video."
  - The AI should use the **tools** (or code) on the loaded data and give a relevant answer.
- **Prompt**
  - Open `public/prompt_chat.txt` and confirm it describes that users can drag-and-drop JSON and that it loads into the conversation context.

---

## 4. Chat tool: `generateImage` (10 pts)

- **Anchor image + prompt**
  - In the chat, attach an **image** (drag-and-drop or paste).
  - Type a request that asks for image generation/editing, e.g. "Generate an image that makes this look like a painting" or "Create a variation of this image with more contrast."
  - Send.
- **Tool usage**
  - The model should call the **generateImage** tool (you may see a tool-call summary in the message).
  - A **generated image** should appear in the assistant’s reply.
- **Download**
  - There should be a **Download** (or similar) control for that image. Use it and confirm a file is saved.
- **Lightbox**
  - **Click the generated image**. It should open in a **lightbox/modal** (enlarged) with a way to close (e.g. X or click outside).
- **Prompt**
  - In `public/prompt_chat.txt`, confirm **generateImage** is described (purpose: image from text prompt and anchor image).

---

## 5. Chat tool: `plot_metric_vs_time` (15 pts)

- **Load channel JSON**
  - Attach `public/veritasium-channel-10.json` (or another channel JSON with numeric fields and dates) to the chat.
  - Send so it’s in context.
- **Ask for a time-series plot**
  - Ask: "Plot views over time" or "Plot view_count vs time" or "Show me likes over time."
  - The AI should call **plot_metric_vs_time** (or equivalent) and a **chart** should appear in the reply.
- **Chart**
  - The chart should be a **React-rendered chart** (e.g. line or bar) with time (or date) on the x-axis and the metric on the y-axis.
- **Enlarge**
  - **Click the chart**. It should **enlarge** (e.g. in a modal/lightbox).
- **Download**
  - There should be a **Download** option (e.g. in the lightbox or next to the chart) that saves the chart as an image (e.g. PNG).
- **Prompt**
  - In `public/prompt_chat.txt`, confirm **plot_metric_vs_time** is described (plot numeric field vs time for channel videos).

---

## 6. Chat tool: `play_video` (15 pts)

- **Load channel JSON**
  - Attach `public/veritasium-channel-10.json` (or a channel JSON that has videos with titles and URLs).
  - Send so it’s in context.
- **By title**
  - Ask: "Play the asbestos video" (or a title that exists in the JSON, e.g. "Asbestos is a bigger problem...").
  - A **card** (or similar) should appear with the **video title** and **thumbnail**.
  - **Click** the card (or Play button). The **YouTube video** should open in a **new browser tab**.
- **By ordinal**
  - Ask: "Play the first video" or "Open the third video."
  - Again, a card with title and thumbnail should appear; clicking opens the correct video in a new tab.
- **Most viewed**
  - If your JSON has non-zero `viewCount`, ask: "Play the most viewed video."
  - The app should pick the video with highest view count and show a card that opens it in a new tab.
- **Prompt**
  - In `public/prompt_chat.txt`, confirm **play_video** is described (play/open video by title, ordinal, or "most viewed"; title + thumbnail; opens in new tab).

---

## 7. Chat tool: `compute_stats_json` (10 pts)

- **Load channel JSON**
  - Attach a channel JSON that has **numeric fields** (e.g. `viewCount`, `likeCount`, `commentCount`). If `public/veritasium-channel-10.json` has zeros, you can temporarily edit it to add sample numbers for testing, or use another JSON with real counts.
  - Send so it’s in context.
- **Ask for statistics**
  - Ask: "What's the average view count?" or "Give me statistics for like_count" or "Compute stats for comment count."
  - The AI should call **compute_stats_json** and reply with **mean, median, std, min, max** (and possibly count) for that field.
- **Check numbers**
  - Manually verify one or two (e.g. mean of view counts) to ensure the tool result is correct.
- **Prompt**
  - In `public/prompt_chat.txt`, confirm **compute_stats_json** is described (mean, median, std, min, max for numeric fields in channel JSON).

---

## 8. Prompt engineering (5 pts)

- **Open** `public/prompt_chat.txt`.
- **Check:**
  - The system prompt states the AI is a **YouTube analysis assistant** (or equivalent).
  - It explains that the AI will receive **JSON files of YouTube channel data**.
  - It explains that the AI has **tools** to analyze data and generate content.
  - All four tools are **named and described**: **generateImage**, **plot_metric_vs_time**, **play_video**, **compute_stats_json**.

---

## Quick checklist (rubric order)

| # | What to test | Pass? |
|---|----------------|-------|
| 1 | First/Last name in form, in DB, in chat; AI greets by name | ☐ |
| 2 | YouTube Channel Download tab: URL, max videos, progress bar, download JSON; sample file in public/ | ☐ |
| 3 | Drag-and-drop JSON into chat, loads into context; AI uses it; described in prompt_chat.txt | ☐ |
| 4 | generateImage works; image in chat; download + lightbox; in prompt_chat.txt | ☐ |
| 5 | plot_metric_vs_time works; React chart; enlarge + download; in prompt_chat.txt | ☐ |
| 6 | play_video works; title + thumbnail card; click opens new tab; by title/ordinal/most viewed; in prompt_chat.txt | ☐ |
| 7 | compute_stats_json works; mean/median/std/min/max; in prompt_chat.txt | ☐ |
| 8 | prompt_chat.txt: YouTube assistant, JSON input, all tools described | ☐ |

---

**Note:** If a feature is not implemented yet, that row won’t pass; use this guide to test as you implement each part.
