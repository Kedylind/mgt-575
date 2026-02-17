# Agent Instructions: AI Video Narration App — HW3 Feature Development

This document gives another agent step-by-step instructions to implement the required homework features in the existing AI video narration app. Implement changes in **App.js** and **App.css** only unless a task explicitly requires new files. Preserve existing behavior where not specified.

---

## Grading Breakdown (100 Points)

| Task Component | Points | Requirement |
|----------------|--------|-------------|
| **PDF Integration** | 25 | Successfully extract text from PDF and use it in the narration prompt. Include the PDF content in the narration prompt file `public/prompt_narration.txt`. |
| **Voice Dropdown** | 15 | Functional menu with **all** OpenAI default voices. |
| **Voice JSON File** | 15 | Properly formatted `voice_description.json` in the **public** folder with all OpenAI default voices and correct descriptions. |
| **Magic Wand Logic** | 25 | Button selects a voice via AI and displays a valid justification. The prompt must use: voice description JSON, video images, narration instructions, PDF content, and generated narration text. Prompt stored in `public/prompt_voice.txt`. |
| **Heartbeat UI** | 10 | Heart buttons (❤️) that **pulse** during all loading/processing states (generating text, audio, merging). |
| **Proper Submission** | 10 | Zip contains only the requested files with exact naming and folder structure. |

---

## 1. PDF Spec Sheet Integration (25 pts)

### Goal
Let the user upload a Product Spec Sheet (PDF), extract its text, and inject that text into the narration AI prompt so the narration is informed by product facts.

### Steps

1. **Add PDF upload and state (App.js)**
   - Add state, e.g. `pdfFile` (File or null) and `pdfText` (string, extracted text).
   - In the Narration tab, add a **file input** for PDFs (e.g. `accept="application/pdf"`). On change, store the file and trigger text extraction.

2. **Extract text from PDF**
   - Use a client-side PDF library. Common options:
     - **pdf.js (Mozilla PDF.js)** — `getDocument()` + `getPage()` + `getTextContent()` to get text per page, then concatenate.
     - Or **pdfjs-dist** (npm): same API.
   - After extraction, set `pdfText` (and optionally keep `pdfFile` for reference). Handle errors (e.g. show a message if extraction fails).

3. **Include PDF content in the narration prompt**
   - Edit **`public/prompt_narration.txt`** to add a placeholder for PDF content, e.g. `{pdf_content}` (or `{product_spec}`).
   - In `loadPromptTemplate()` (or equivalent) in App.js:
     - Fetch the template from `public/prompt_narration.txt`.
     - Replace `{pdf_content}` with the extracted `pdfText` (or a safe default like “No product spec provided” when `pdfText` is empty).
   - Keep existing placeholders: `{num_words}`, `{instructions}`.
   - Ensure the prompt clearly tells the model to use the product spec to inform the narration (e.g. “Use the following product spec sheet to inform your narration where relevant: …”).

**Acceptance:** Uploading a PDF, entering instructions, and generating narration results in narration that can reflect the PDF content, and the prompt template in `public/prompt_narration.txt` explicitly includes that PDF content via a placeholder.

---

## 2. Voice Selection Menu (15 pts)

### Goal
A dropdown that lists **all** OpenAI default TTS voices. The selected voice is used when generating narration audio.

### Steps

1. **Define the list of OpenAI default voices**
   - As of current API docs, default voices include at least: **alloy**, **ash**, **ballad**, **coral**, **echo**, **fable**, **nova**, **onyx**, **sage**, **shimmer**, **verse**, **marin**, **cedar**. Verify against the [OpenAI Text-to-Speech docs](https://platform.openai.com/docs/guides/text-to-speech) for the model in use (e.g. `gpt-4o-mini-tts`) and include every documented default voice—no fewer.

2. **Add state and UI (App.js)**
   - Add state, e.g. `selectedVoice` (string), defaulting to one of the voices (e.g. `'nova'`).
   - In the Narration tab, in or near the “Create Narration Audio” section, add a **&lt;select&gt;** (or equivalent) labeled e.g. “Voice”. Options: one &lt;option&gt; per voice, value = voice id (e.g. `alloy`), label = human-readable name (e.g. “Alloy”).

3. **Use selected voice in TTS**
   - In `createNarrationAudio()`, replace the hardcoded `voice: 'nova'` with `voice: selectedVoice` (or your state variable name) in the `openai.audio.speech.create()` call.

**Acceptance:** User can choose any OpenAI default voice from the dropdown; generating narration audio uses the selected voice.

---

## 3. Voice JSON File (15 pts)

### Goal
A JSON file in **public** that maps each OpenAI default voice to a short “vibe” and use case. Same voice set as in the dropdown.

### Steps

1. **Create `public/voice_description.json`**
   - Format (exactly as specified):
     ```json
     {
       "voice_id_1": "Short description of vibe and best use case.",
       "voice_id_2": "Short description of vibe and best use case.",
       ...
     }
     ```
   - Keys must be the **exact** voice IDs used in the API (e.g. `alloy`, `nova`, `shimmer`). Values are one short sentence each: tone/vibe + when to use (e.g. “Calm and neutral; good for tutorials and explainers”).

2. **Include every OpenAI default voice**
   - Same list as in the Voice Dropdown (Task 2). No extra voices; no missing voices.

**Acceptance:** File exists at `public/voice_description.json`, is valid JSON, and every default voice has one key and one description string.

---

## 4. The “Magic Wand” Selector (25 pts)

### Goal
A 🪄 button that asks an AI to pick the best voice given: voice descriptions, video frames, narration instructions, PDF content, and the **generated narration text**. Show the chosen voice and a **written justification** in the app.

### Steps

1. **Create the prompt file**
   - Create **`public/prompt_voice.txt`**.
   - The prompt must instruct the model to:
     - Consider: (1) the contents of `voice_description.json`, (2) the video images (or a description of them), (3) the narration instructions, (4) the PDF/product spec content, (5) the **generated narration text**.
     - Choose the single best voice and explain why in a short paragraph.
   - **Requirement:** Ask the model to respond in **JSON format** so the app can parse it reliably. For example:
     - `{ "voice": "nova", "justification": "..." }`
   - In the prompt, specify the exact keys (e.g. `voice`, `justification`) and that the response must be valid JSON only (no markdown code fences if possible, or instruct to strip them if you parse in code).

2. **Implement Magic Wand in App.js**
   - Add state, e.g. `magicWandVoice` (string or null), `magicWandJustification` (string), `isSelectingVoice` (boolean).
   - Add a **🪄 button** (e.g. “Pick best voice” or “Magic Wand”) in the Narration tab. Place it near the voice dropdown and “Create Narration Audio.”
   - When clicked:
     - Require: narration text already generated, and ideally video/instructions/PDF available.
     - Set `isSelectingVoice` to true.
     - Fetch `public/prompt_voice.txt` and `public/voice_description.json`.
     - Build the prompt: substitute into the template the voice description JSON (stringified or formatted), narration instructions, PDF content, and the **generated narration text**. Include the video context: either send the same frame images you use for narration, or a short text summary (e.g. from an earlier step); the grading requirement is that the prompt uses “the video images” — so include them (e.g. as base64 image inputs in the same way as in `createNarrationText`).
     - Call the same OpenAI API used for narration (e.g. Responses API with the same model) with this prompt and the video images.
     - Parse the response: extract JSON and read `voice` and `justification`. Validate that `voice` is one of the known voices; if not, fallback to a default and still show the justification.
     - Set `magicWandVoice` and `magicWandJustification`, then set `isSelectingVoice` to false. If the AI returns a valid voice id, update `selectedVoice` so the dropdown reflects the choice.

3. **Display the result**
   - Show the chosen voice name (and optionally set the dropdown to it).
   - Show the **written explanation** (justification) in the UI, e.g. in a small card or paragraph below the button.

**Acceptance:** Clicking 🪄 runs an AI prompt that uses voice_description.json, video images, narration instructions, PDF content, and narration text; the prompt is stored in `public/prompt_voice.txt`; the app shows the selected voice and a clear written justification; response is requested and parsed as JSON.

---

## 5. Heartbeat UI (10 pts)

### Goal
Action buttons are styled as **hearts (❤️)** and **pulse** with a CSS keyframe animation whenever the app is in a loading/processing state (generating text, generating audio, merging video).

### Steps

1. **Style buttons as hearts**
   - Identify the main action buttons: “Create Narration Text”, “Create Narration Audio”, “Create Video” (merge). Optionally include “Magic Wand” if it triggers loading.
   - In **App.js**: either use the heart character in the button label (e.g. “❤️ Create Narration Text”) or use a span/icon with ❤️ so the button is clearly heart-themed. All three (or four) actions must be represented as heart buttons.

2. **Pulse during loading**
   - In **App.css** (or, if necessary for dynamic class names, in App.js via inline styles or a class toggled in JS), define a **keyframe animation** that creates a “heartbeat” pulse (e.g. scale up and down, or opacity pulse).
   - Apply this animation to these buttons **only when**:
     - `isGeneratingText` is true (Create Narration Text),
     - `isGeneratingAudio` is true (Create Narration Audio),
     - `isMerging` is true (Create Video),
     - and, if applicable, `isSelectingVoice` is true (Magic Wand).
   - Use a CSS class (e.g. `btn-loading` or `heart-pulse`) that you add when the corresponding loading state is true and remove when false. The existing app already uses `btn-loading` for some buttons; extend this so **all** of the above actions show the pulse while processing.

3. **Keep code in App.css or App.js**
   - Keyframes and the pulse class must be defined in **App.css** (preferred) or, if needed, in **App.js** (e.g. via a style tag or global style object). Do not move this feature to a separate CSS file that is not part of the submission.

**Acceptance:** The relevant action buttons look like heart actions (❤️) and visibly pulse for the full duration of “generating text,” “generating audio,” and “merging” (and Magic Wand if implemented).

---

## File and Code Reference (Current App)

- **Narration prompt:** Fetched from `/prompt_narration.txt` in `loadPromptTemplate()`. Placeholders: `{num_words}`, `{instructions}`. Add `{pdf_content}` (or similar) and replace it with extracted PDF text.
- **TTS call:** `openai.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: 'nova', input: narrationText })` in `createNarrationAudio()`. Change `voice` to the value from the dropdown state.
- **Loading flags:** `isGeneratingText`, `isGeneratingAudio`, `isMerging`. Use these (and add `isSelectingVoice` for Magic Wand) to toggle the heart pulse class.
- **Vision + text:** `createNarrationText()` uses `openai.responses.create()` with `input_text` and `input_image` content. Reuse the same pattern for the Magic Wand request, with the prompt from `prompt_voice.txt` and the same frame images.

---

## Summary Checklist for the Agent

- [ ] PDF upload; extract text; add `{pdf_content}` to `public/prompt_narration.txt` and replace it in code.
- [ ] Voice dropdown with **all** OpenAI default voices; TTS uses selected voice.
- [ ] `public/voice_description.json` with every default voice and a short description per voice.
- [ ] `public/prompt_voice.txt` with prompt that uses voice JSON, video images, instructions, PDF, and narration text; asks for JSON response (voice + justification).
- [ ] Magic Wand button: loads prompt + JSON, calls API with images, parses JSON, updates selected voice and shows justification.
- [ ] Heart buttons (❤️) for Create Narration Text, Create Narration Audio, Create Video (and optionally Magic Wand); CSS keyframe pulse when any of these is in a loading state.
