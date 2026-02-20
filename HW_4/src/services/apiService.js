import { GoogleGenAI, Type } from '@google/genai';

const API_KEY = (process.env.REACT_APP_GEMINI_API_KEY || '').trim();
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

async function loadChatPrompt() {
  const res = await fetch('/chat_prompt.txt');
  if (!res.ok) throw new Error('Failed to load chat_prompt.txt');
  return res.text();
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * Tool definitions for chat: generateMovieScript, translateNarrations, YouTube title/description/thumbnail.
 */
const chatToolDeclarations = [
  {
    name: 'generateMovieScript',
    description: 'Writes the generated movie script with scenes into the scene editor. Call this when the user has described their idea and you are ready to produce the script.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scenes: {
          type: Type.ARRAY,
          description: 'Array of scene objects for the video reel',
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER, description: 'Scene number (1-based index)' },
              description: { type: Type.STRING, description: 'Vivid visual description for image generation' },
              narration: { type: Type.STRING, description: 'Narration text with optional TTS tags like [excited] or [whispering]' },
            },
            required: ['sceneNumber', 'description', 'narration'],
          },
        },
      },
      required: ['scenes'],
    },
  },
  {
    name: 'translateNarrations',
    description: 'Call this when the user wants to translate the narrations to another language. Pass the target language and the array of translated narration texts in scene order; this will update the scene editor.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetLanguage: { type: Type.STRING, description: 'Target language name or code (e.g. Spanish, es, French)' },
        translatedNarrations: {
          type: Type.ARRAY,
          description: 'Array of translated narration strings, one per scene in order',
          items: { type: Type.STRING },
        },
      },
      required: ['targetLanguage', 'translatedNarrations'],
    },
  },
  {
    name: 'generateYouTubeTitle',
    description: 'Call when the user wants a YouTube title. Use the current script and images (provided in context) to suggest one catchy title. Pass the result in the title parameter.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'The suggested YouTube video title' },
      },
      required: ['title'],
    },
  },
  {
    name: 'generateYouTubeDescription',
    description: 'Call when the user wants a YouTube description. Use the current script and images (provided in context) to write a short description. Pass the result in the description parameter.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING, description: 'The YouTube video description (e.g. 1-2 paragraphs)' },
      },
      required: ['description'],
    },
  },
  {
    name: 'generateYouTubeThumbnail',
    description: 'Call when the user wants a YouTube thumbnail. The app will generate an image using the current script and images and display it in the YouTube section.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        imagePrompt: { type: Type.STRING, description: 'Optional override prompt for the thumbnail image; if omitted, app uses script and images.' },
      },
      required: [],
    },
  },
];

export const movieTool = { functionDeclarations: chatToolDeclarations.slice(0, 1) };

const chatTools = { functionDeclarations: chatToolDeclarations };

/**
 * Create and return a chat session configured with all chat tools and system prompt.
 * Uses ai.chats.create() (not getGenerativeModel/startChat - those are from the older @google/generative-ai SDK).
 * @returns {Promise<Object|null>} Chat instance or null if API key missing
 */
export async function createAssistantChat() {
  if (!ai) return null;

  const systemInstruction = await loadChatPrompt();

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      tools: [chatTools],
      toolConfig: {
        functionCallingConfig: {
          mode: 'AUTO',
        },
      },
    },
  });

  return chat;
}

/**
 * Format current script (scenes) into a readable string for the AI context.
 * @param {Array<{sceneNumber: number, description: string, narration: string}>} scenes
 * @returns {string}
 */
function formatScriptForContext(scenes) {
  if (!scenes?.length) return '';
  return scenes
    .map(
      (s) =>
        `Scene ${s.sceneNumber ?? '?'} — Description: ${(s.description ?? '').trim() || '(none)'}\nNarration: ${(s.narration ?? '').trim() || '(none)'}`
    )
    .join('\n\n');
}

/**
 * Send a message to the assistant and process the response (streaming).
 * Calls onChunk(text) as text arrives. If the response contains function calls (generateMovieScript), executes onScript.
 * @param {Object} chat - Chat instance from createAssistantChat
 * @param {string} message - User message
 * @param {Function} onScript - Callback (args) => void when generateMovieScript is called
 * @param {Array<Blob|File|null>} [anchorImages] - Optional anchor images [image1, image2, image3] to include in context
 * @param {Function} [onChunk] - Callback (text) => void for streaming text as it arrives
 * @param {Array<{sceneNumber: number, description: string, narration: string}>} [currentScript] - Current scenes for context
 * @param {Object} [callbacks] - Optional: onTranslateNarrations, onYouTubeTitle, onYouTubeDescription, onYouTubeThumbnail
 * @returns {Promise<{text: string, functionCalled: boolean}>}
 */
export async function sendAssistantMessage(chat, message, onScript, anchorImages = [], onChunk, currentScript = [], callbacks = {}) {
  if (!chat) throw new Error('API key not configured');
  console.log('[AI Reel Maker] sendAssistantMessage called');

  const scriptBlock = formatScriptForContext(currentScript);
  let textContent = message;
  if (scriptBlock) {
    textContent = `Here is the user's current movie script (for context). Each scene has a number, description, and narration. Use it to answer questions about specific scenes and suggest improvements.\n\n${scriptBlock}\n\n---\n\nUser message: ${message}`;
  }

  let messageContent = textContent;
  const hasImages = anchorImages?.some((img) => img != null);
  if (hasImages) {
    const parts = [{ text: `Here are my anchor images (image 1, 2, 3) for style reference:\n\n${textContent}` }];
    for (let i = 0; i < 3; i++) {
      const img = anchorImages[i];
      if (img) {
        const base64 = await blobToBase64(img);
        const mime = img.type || 'image/png';
        parts.push({ inlineData: { mimeType: mime, data: base64 } });
      }
    }
    messageContent = parts;
  }

  // Use non-streaming: streaming + function calls can hang (API waits for function response before stream ends)
  const response = await chat.sendMessage({ message: messageContent });

  // Extract function calls - check both getter and parts (SDK structure can vary)
  let functionCalls = response?.functionCalls;
  if (!functionCalls?.length) {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall).filter(Boolean);
  }
  const text = response?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('')
    .trim() || '';

  const { onTranslateNarrations, onYouTubeTitle, onYouTubeDescription, onYouTubeThumbnail } = callbacks;

  console.log('[AI Reel Maker] hasFunctionCalls:', !!functionCalls?.length, '| functionCallNames:', functionCalls?.map((fc) => fc?.name) || [], '| textLength:', text?.length || 0);
  if (functionCalls && functionCalls.length > 0) {
    console.log('[AI Reel Maker] Tool called:', functionCalls.map((fc) => ({ name: fc?.name, args: fc?.args })));
    let confirmText = '';
    for (const fc of functionCalls) {
      if (fc?.name === 'generateMovieScript' && fc?.args) {
        console.log('[AI Reel Maker] Executing generateMovieScript, scenes count:', fc.args.scenes?.length);
        onScript(fc.args);
        confirmText = confirmText || 'I\'ve added the script to your scene editor. You can review and edit it there, then generate images and audio for each scene.';
      }
      if (fc?.name === 'translateNarrations' && fc?.args && onTranslateNarrations) {
        onTranslateNarrations(fc.args);
        confirmText = confirmText || 'I\'ve updated the narrations with the translation.';
      }
      if (fc?.name === 'generateYouTubeTitle' && fc?.args?.title != null && onYouTubeTitle) {
        onYouTubeTitle(fc.args.title);
        confirmText = confirmText || 'I\'ve set the YouTube title.';
      }
      if (fc?.name === 'generateYouTubeDescription' && fc?.args?.description != null && onYouTubeDescription) {
        onYouTubeDescription(fc.args.description);
        confirmText = confirmText || 'I\'ve set the YouTube description.';
      }
      if (fc?.name === 'generateYouTubeThumbnail' && onYouTubeThumbnail) {
        onYouTubeThumbnail(fc?.args);
        confirmText = confirmText || 'I\'ve triggered thumbnail generation; it will appear in the YouTube section.';
      }
    }
    if (confirmText) {
      onChunk?.(confirmText);
      return { text: confirmText, functionCalled: true };
    }
  }

  console.log('[AI Reel Maker] Text response (no tool call), length:', text?.length);

  // Fallback: model sometimes outputs JSON as text instead of calling the tool - try to parse and apply
  const parsed = tryParseScriptFromText(text);
  if (parsed) {
    console.log('[AI Reel Maker] Parsed script from text fallback, scenes count:', parsed.scenes?.length);
    onScript(parsed);
    const confirmText = 'I\'ve added the script to your scene editor. You can review and edit it there, then generate images and audio for each scene.';
    onChunk?.(confirmText);
    return { text: confirmText, functionCalled: true };
  }

  onChunk?.(text);
  return { text, functionCalled: false };
}

/** Try to extract and parse a scenes array from model text (fallback when model outputs JSON instead of calling tool) */
function tryParseScriptFromText(text) {
  if (!text?.trim()) return null;
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const scenes = arr.filter((s) => s && (s.description || s.narration));
    if (scenes.length === 0) return null;
    return { scenes };
  } catch {
    return null;
  }
}
