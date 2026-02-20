# HW_4: AI Reel Maker — Implementation Plan for New Features

This document is a detailed plan for implementing the remaining Homework 4 features. Use it as a handoff for the next agent. The codebase is a React app with chat (Gemini), scene editor, and video assembly; the plan aligns with the **grading breakdown** and the assignment instructions.

---

## Grading alignment (reference)

| Component | Points | Requirement |
|-----------|--------|-------------|
| Smart Context | 15 | Full script passed to chat; AI can answer questions about specific scenes. |
| Translation UI | 20 | Dropdown, AI translation logic, Original/Translated toggle all functional. Languages from all human-inhabited continents. |
| YouTube UI Suite | 20 | Title, Description, Thumbnail generation buttons work and display results in the UI. |
| Translation Chat Tool | 15 | Tool is functional, defined in code, and mentioned in `public/chat_prompt.txt`. |
| YouTube Chat Tools | 20 | Title, Description, Thumbnail tools functional, defined in code, mentioned in `public/chat_prompt.txt`, use script and images as context, display output in the app. |

---

## Current state (summary)

- **Chat**: System prompt from `public/chat_prompt.txt`; single tool `generateMovieScript` in `src/services/apiService.js`. **The current script (scenes) is not sent to the chat** — only the user message and optional anchor images are. So the AI cannot reference or improve specific scenes.
- **Translation**: No translation UI or logic anywhere.
- **YouTube**: No YouTube metadata (title, description, thumbnail) UI or tools.
- **Tools**: Only `generateMovieScript`; no `translateNarrations`, `generateYouTubeTitle`, `generateYouTubeDescription`, or `generateYouTubeThumbnail`.

---

## 1. Smart Chat Context (15 pts)

**Goal:** Load the generated script (all scene descriptions and narrations) into the chat context so the AI can reference and suggest improvements to specific scenes.

### Where to change

- **`src/services/apiService.js`**
  - `sendAssistantMessage(chat, message, onScript, anchorImages = [], onChunk)` currently builds `messageContent` from only `message` (and optionally anchor images). It does not receive or send the current `scenes`.
- **`src/App.js`**
  - `handleChatSend` calls `sendAssistantMessage(chat, message, handleAssistantScript, anchorImages, onChunk)`. It does not pass `scenes`.

### Implementation steps

1. **Extend `sendAssistantMessage`** to accept an optional **current script** (e.g. `scenes` or a serialized string).
   - Signature suggestion: add a parameter such as `currentScript` (array of `{ sceneNumber, description, narration }` or a preformatted string).
2. **Prepend script to context** when `currentScript` is non-empty:
   - Either prepend a **system-side** message (if the SDK supports multiple system parts), or
   - Prepend a **user-side** message such as:  
     `"Here is the user's current movie script (for context). Each scene has a number, description, and narration:\n\n" + <formatted script>`  
     so the model always sees the script when the user asks for edits or suggestions.
3. **Format the script** in a clear, readable way (e.g. "Scene 1 — Description: ... Narration: ..." or a short JSON-like block) so the AI can refer to "Scene 2" or "the first narration."
4. **In `App.js`**, pass the current `scenes` into `sendAssistantMessage` (e.g. as the new `currentScript` argument). Ensure the dependency array of `handleChatSend` includes `scenes` so the latest script is always sent.
5. **Optional but recommended:** In `public/chat_prompt.txt`, add one or two lines telling the assistant that it will receive the current script when available and that it should use it to answer questions about specific scenes and suggest improvements.

### Verification

- Generate a movie script (via "Generate Scenes" or chat), then ask in chat: "Suggest an improvement to the narration of scene 2" or "What happens in scene 1?". The AI should reference the actual content of the script.

---

## 2. Translation Feature (UI) (20 pts)

**Goal:** Add a translation suite to the **scene editor**: dropdown for target language, "Translate" button (AI translates all narrations), and Original/Translated toggle in the narration text boxes. Languages must include at least one from **every human-inhabited continent** (deduction if one is missing).

### Where to change

- **`src/components/SceneEditor.js`** — main place for:
  - Language dropdown (target language).
  - "Translate" button.
  - Toggle to show "Original" vs "Translated" in narration cells.
- **`src/services/gemini.js`** (or a dedicated translation helper) — new function to call Gemini to translate a list of texts (narrations) into the target language.
- **State:** Either in `SceneEditor` (local state for translated narrations + toggle) or in `App.js` (e.g. `translatedNarrations` array and `showTranslatedNarrations`). If stored in App, pass props down and add `onUpdate` or a dedicated handler for applying translations back to scenes if desired.

### Language list (all continents)

Ensure the dropdown includes at least one language per continent, e.g.:

- **Africa:** e.g. Swahili, Arabic (e.g. Egyptian), or another major African language.
- **Antarctica:** No native languages; omit or add a note. Grading says "human-inhabited continents"; typically Antarctica is excluded, so 6 continents is the usual interpretation: Africa, Asia, Europe, North America, South America, Oceania.
- **Asia:** e.g. Hindi, Mandarin Chinese, Japanese, Korean.
- **Europe:** e.g. Spanish, French, German, Italian.
- **North America:** e.g. English, Spanish.
- **South America:** e.g. Spanish, Portuguese.
- **Oceania:** e.g. Māori, or a widely used Pacific language.

Provide a **fixed list of languages** with a clear **target language code** or **label** (e.g. "Spanish (Spain)", "French (France)", "Arabic (Egypt)", "Swahili", "Hindi", "Chinese (Mandarin)", "Japanese", "Māori") so the AI and UI stay in sync.

### Implementation steps

1. **Define language list** in a constant (e.g. in `SceneEditor.js` or `src/constants/languages.js`) with at least one language per human-inhabited continent (Africa, Asia, Europe, North America, South America, Oceania). Include a code/identifier for the API (e.g. "es", "fr", "ar", "sw", "hi", "zh", "ja", "mi").
2. **Translation API:** In `gemini.js` add something like `translateNarrations(narrationsArray, targetLanguageCode)` that sends the texts plus target language to Gemini and returns an array of translated strings (same order and length). Use a single prompt that asks for only the translations (e.g. JSON array) to keep parsing simple.
3. **SceneEditor UI:**
   - Add a **dropdown** for target language (use the constant list).
   - Add a **"Translate"** button. On click: call the translation function with current `scenes.map(s => s.narration)` and target language; store results (e.g. `translatedNarrations = [t1, t2, ...]`). Disable button while loading; show loading state.
   - For each scene row, in the **Narration** cell:
     - Add a **toggle** (e.g. "Original" / "Translated") that switches which text is shown in the textarea (and optionally which is edited). If you store only "original" in `scene.narration` and "translated" in local/App state, the textarea can show either and optionally "Apply translation" to copy translated back to `scene.narration`.
   - Ensure the toggle is clearly visible (e.g. above the table or per-row) and that both Original and Translated are functional (readable and editable if required).
4. **State ownership:** If `translatedNarrations` lives in `App.js`, pass it and a setter (or a single handler like `onTranslatedNarrations(sceneIndex, translatedText)`) to `SceneEditor`; if in `SceneEditor`, pass `scenes` and ensure parent doesn’t need to know about translated text except for persistence (e.g. "Apply to script" button that writes translated back to `scenes`).
5. **Edge cases:** Empty narrations: either skip or send empty string and get empty string back. After user adds/removes scenes, clear or recompute `translatedNarrations` so indices match.

### Verification

- Select a language from each continent, click "Translate", then toggle Original/Translated and confirm the narration boxes show the correct content. Ensure the dropdown clearly includes languages from all required continents.

---

## 3. YouTube Metadata Suite (UI) (20 pts)

**Goal:** A YouTube metadata section with: (1) Title & Description — buttons to generate with AI, display in UI; (2) Thumbnail — dropdown for image model (cheap/expensive), Generate Image button, display of the resulting image. AI must use **script and images** as context.

### Where to change

- **New section in the app:** Either a new component (e.g. `src/components/YouTubeMetadata.js`) or a new subsection inside an existing section (e.g. after "Edit Scenes" or in "Video Generation"). The assignment says "YouTube metadata section" — a dedicated component is cleaner.
- **`src/App.js`** — add state for `youtubeTitle`, `youtubeDescription`, `youtubeThumbnailBlob` (or similar), and pass scenes + anchor images into the YouTube component and to the Gemini calls.
- **`src/services/gemini.js`** — add:
  - `generateYouTubeTitle(scriptContext, anchorImages)` 
  - `generateYouTubeDescription(scriptContext, anchorImages)` 
  - `generateYouTubeThumbnail(scriptContext, anchorImages, modelId)`  
  Each should send the **script** (descriptions + narrations) and **anchor images** (if any) so the model can use them as context. Title/description return strings; thumbnail returns a Blob (reuse existing image-generation pattern from `generateImage`).

### Implementation steps

1. **State in App.js**
   - `youtubeTitle`, `youtubeDescription`, `youtubeThumbnailBlob`, and optionally loading flags for each (`youtubeTitleLoading`, etc.).
2. **Gemini service**
   - **Script context:** Build a string (or structured prompt) from `scenes`: e.g. concatenate "Scene N: Description: ... Narration: ..." for all scenes.
   - **generateYouTubeTitle(scriptContext, anchorImages):** Prompt: use script + images to generate a single catchy YouTube title. Return plain text.
   - **generateYouTubeDescription(scriptContext, anchorImages):** Same idea; return a short description (e.g. 1–2 paragraphs). Include images in the request if present.
   - **generateYouTubeThumbnail(scriptContext, anchorImages, modelId):** Same as scene images: text prompt derived from script (e.g. "Create a thumbnail that represents this video: ...") plus optional anchor images; use existing `generateImage`-style call with `modelId` (cheap vs expensive). Return Blob.
3. **Image model dropdown**
   - Reuse or mirror `IMAGE_MODELS` (e.g. "cheap" = `gemini-2.5-flash-image`, "expensive" = `gemini-3-pro-image-preview`). Label clearly in UI (e.g. "Thumbnail model: Cheap / Expensive").
4. **YouTube UI component**
   - **Title:** Text display (or input) + "Generate Title" button → call `generateYouTubeTitle`, set `youtubeTitle`, show in UI.
   - **Description:** Text area or read-only block + "Generate Description" button → call `generateYouTubeDescription`, set `youtubeDescription`, show in UI.
   - **Thumbnail:** Dropdown (model) + "Generate Image" button + image preview (e.g. `<img src={thumbnailUrl} />` from blob). On success, set `youtubeThumbnailBlob`.
5. **Placement**
   - Render the YouTube section only when `scenes.length > 0` (same as Scene Editor), and pass `scenes`, `anchorImages`, and the state/setters for title, description, thumbnail.

### Verification

- Generate a script (and optionally anchor images), then use each button. Confirm title and description appear in the UI and thumbnail image displays. Confirm in code that script and images are passed into the Gemini calls.

---

## 4. Chat Tool: translateNarrations (15 pts)

**Goal:** A chat tool that translates narrations via chat and **updates the narration boxes** with the translated text. Must be **defined in code** and **mentioned in `public/chat_prompt.txt`**.

### Where to change

- **`src/services/apiService.js`**
  - Add a new function declaration to the tools array (same structure as `generateMovieScript`). Name: `translateNarrations`. Parameters: e.g. `targetLanguage` (string), `translatedNarrations` (array of strings, one per scene). Description: e.g. "Call this when the user wants to translate the narrations to another language. Pass the target language and the array of translated narration texts in scene order; this will update the scene editor."
  - In `sendAssistantMessage`, when handling function calls, detect `translateNarrations` and call a new callback (e.g. `onTranslateNarrations(args)`).
- **`src/App.js`**
  - Implement `handleTranslateNarrations(args)`: update `scenes` so that `scene[i].narration = args.translatedNarrations[i]` (with bounds check). Pass this callback into the send path (same way as `onScript`). The chat send function must accept and use this handler.
- **`public/chat_prompt.txt`**
  - Add a short paragraph describing the tool: "You have a tool **translateNarrations**: when the user asks to translate the narrations to a specific language, call it with the target language name/code and an array of translated narration strings (one per scene, in order). This updates the narration boxes in the scene editor."

### Implementation steps

1. In `apiService.js`, extend the tool definition (e.g. add a second object to `functionDeclarations` or add a second tool to the `tools` array) for `translateNarrations` with parameters `targetLanguage` and `translatedNarrations` (array of strings).
2. In the same file, in the response-processing loop where you handle `generateMovieScript`, add a branch for `translateNarrations`: call `onTranslateNarrations(fc.args)` (or similar). The function `sendAssistantMessage` must accept this callback (e.g. `onTranslateNarrations`) and pass it when invoking the handler.
3. In `App.js`, add `handleTranslateNarrations` that updates `scenes` from `args.translatedNarrations`. Pass it into the chat send logic (you may need to pass an object of callbacks or add another parameter to `sendAssistantMessage`).
4. Update `public/chat_prompt.txt`: describe when and how to use `translateNarrations` so the model knows to call it with target language and the translated array.

### Verification

- In chat, ask e.g. "Translate all narrations to Spanish" (after having a script). The model should call `translateNarrations` with target language and translated strings; the scene editor narration boxes should update to the translated text.

---

## 5. YouTube Chat Tools (20 pts)

**Goal:** Three chat tools: **generateYouTubeTitle**, **generateYouTubeDescription**, **generateYouTubeThumbnail**. Each must be functional, defined in code, mentioned in `public/chat_prompt.txt`, use **script and images** as context, and **display the output in the app**.

### Where to change

- **`src/services/apiService.js`**
  - Add three new function declarations (same pattern as `generateMovieScript` and `translateNarrations`):
    - **generateYouTubeTitle** — e.g. no parameters, or `title` (string). If the model returns the title in the tool call, use parameter `title`; then the backend just needs to pass it to the app. Alternatively the model could return text and you parse it; simplest is the model calls the tool with `title: "..."`.
    - **generateYouTubeDescription** — e.g. parameter `description` (string).
    - **generateYouTubeThumbnail** — either the model returns a base64 image in the tool call (complex), or the tool is "request thumbnail" and the **app** calls Gemini to generate the image and then sets the thumbnail. Assignment says "generate a thumbnail image ... via chat" and "display output in the app" — so the tool can have a parameter like `imagePrompt` or the app generates the thumbnail when the tool is called (app calls `generateYouTubeThumbnail(script, anchorImages, modelId)` and sets the blob). Easiest: tool has no image payload; when the model calls `generateYouTubeThumbnail`, the app runs the same Gemini thumbnail generation used in the YouTube UI and displays the result. So the tool might have an optional `promptOverride` or no args; the app uses current script + images to generate and then updates UI.
  - In `sendAssistantMessage`, you need to pass **script and images** into the chat so the model can use them for title/description. For thumbnail, the app can generate using script+images when the tool is invoked.
  - Add handlers in the response loop: on `generateYouTubeTitle` → `onYouTubeTitle(args)`; on `generateYouTubeDescription` → `onYouTubeDescription(args)`; on `generateYouTubeThumbnail` → trigger app to generate thumbnail (or pass through args if any) and call `onYouTubeThumbnail(blob)` or set state.
- **`src/App.js`**
  - Add state: `youtubeTitle`, `youtubeDescription`, `youtubeThumbnailBlob` (if not already from YouTube UI). Add handlers `handleYouTubeTitle`, `handleYouTubeDescription`, `handleYouTubeThumbnail` that set this state. Pass these handlers into the chat send path so that when the corresponding tool is called, the UI updates.
  - Ensure the **YouTube metadata section** (from section 3) displays these values; when a tool runs, the same section shows the new title, description, or thumbnail.
- **`public/chat_prompt.txt`**
  - Describe all three tools: e.g. "**generateYouTubeTitle**: Call with a suggested title (string). It will be shown in the YouTube metadata section. Use the user's current script and images as context." Same for description and thumbnail; for thumbnail, clarify that the app will generate the image using the script and images and display it.

### Implementation steps

1. **Tool definitions in apiService.js**
   - **generateYouTubeTitle**: parameter `title` (string). Description: "Call when the user wants a YouTube title. Use the current script and images (provided in context) to suggest one catchy title. Pass the result in the title parameter."
   - **generateYouTubeDescription**: parameter `description` (string). Same idea.
   - **generateYouTubeThumbnail**: optional parameter e.g. `imagePrompt` (string) or none. Description: "Call when the user wants a YouTube thumbnail. The app will generate an image using the current script and images and display it in the YouTube section." When this is called, the app runs the same thumbnail generation logic as the YouTube UI (script + images + selected or default model) and sets `youtubeThumbnailBlob`.
2. **Context for title/description**
   - When sending the user message, the script (and images) are already being sent for Smart Context (section 1). So the model has script + images when it calls the title/description tools; no extra round-trip needed. Just ensure the tool descriptions say "use the script and images provided in the conversation."
3. **Handlers in sendAssistantMessage**
   - For each of the three tools, call the corresponding callback with the right args. For thumbnail, the callback might be `onYouTubeThumbnail()` with no args; the app then calls Gemini to generate the thumbnail and sets state.
4. **App.js**
   - Wire the three callbacks to state setters for `youtubeTitle`, `youtubeDescription`, `youtubeThumbnailBlob`. Ensure the YouTube metadata UI reads from this state so that when the user asks in chat for a title, description, or thumbnail, the result appears in the app.
5. **chat_prompt.txt**
   - Add clear descriptions of all three YouTube tools and when to use them. Mention that the current script and images are in the conversation context.

### Verification

- In chat, ask "Generate a YouTube title for this video" / "Write a YouTube description" / "Generate a thumbnail." Confirm each tool is called, and that the title, description, and thumbnail appear in the YouTube metadata section of the app.

---

## 6. File and code reference summary

| Item | Location |
|------|----------|
| Chat system prompt | `public/chat_prompt.txt` |
| Tool definitions & send message | `src/services/apiService.js` |
| Chat send flow & callbacks | `src/App.js` (`handleChatSend`, `handleAssistantScript`) |
| Scene editor UI | `src/components/SceneEditor.js` |
| Gemini: scenes, image, TTS | `src/services/gemini.js` |
| App state (scenes, anchor images, etc.) | `src/App.js` |

---

## 7. Order of implementation (suggested)

1. **Smart Context** — so script + images are in every chat message; required for the AI to use script in translation and YouTube tools.
2. **Translation UI** — language list, Gemini translation, dropdown, button, toggle in SceneEditor.
3. **YouTube UI** — Gemini title/description/thumbnail helpers, new section, buttons, display.
4. **translateNarrations tool** — tool def, handler, chat_prompt update, wire in App.
5. **YouTube tools** — three tool defs, three handlers, display in existing YouTube section, chat_prompt update.

This order reuses script-in-context for the tools and builds the YouTube UI before wiring the same outputs to the chat tools.

---

## 8. Testing checklist (for grader / self-check)

- [ ] **Smart Context:** After generating a script, ask the assistant about a specific scene (e.g. "Improve the narration of scene 2"); response references actual content.
- [ ] **Translation UI:** Dropdown includes at least one language from Africa, Asia, Europe, North America, South America, Oceania. Translate button runs and fills translated text; Original/Translated toggle shows correct text.
- [ ] **YouTube UI:** Generate Title and Generate Description show results in UI; Thumbnail model dropdown and Generate Image produce and display an image. Script and images are used in API calls.
- [ ] **translateNarrations tool:** In chat, request translation to a language; narration boxes in the scene editor update. Tool is described in `public/chat_prompt.txt`.
- [ ] **YouTube tools:** In chat, request title, description, and thumbnail; each appears in the app. All three tools are described in `public/chat_prompt.txt` and use script and images.

---

End of plan. Implement the sections in order and verify each against the grading requirements before moving on.
