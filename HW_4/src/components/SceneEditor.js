import React, { useState, useEffect } from 'react';
import { IMAGE_MODELS, GEMINI_TTS_VOICES, translateNarrations } from '../services/gemini';
import { TRANSLATION_LANGUAGES } from '../constants/languages';
import AnimatedDots from './AnimatedDots';

function AudioPlayer({ blob }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (blob) {
      const u = URL.createObjectURL(blob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setUrl(null);
  }, [blob]);
  if (!blob) return <span className="text-slate-500 text-xs">No audio</span>;
  if (!url) return <span className="text-slate-500 text-xs">Loading...</span>;
  return <audio src={url} controls className="w-48 h-8" />;
}

function SceneImage({ blob, alt, className, onClick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (blob) {
      const u = URL.createObjectURL(blob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setUrl(null);
  }, [blob]);
  if (!blob) return null;
  if (!url) return <div className={className || 'w-32 h-32 rounded bg-slate-700'} />;
  return <img src={url} alt={alt || ''} className={className} onClick={onClick} />;
}

export default function SceneEditor({ scenes, onUpdate, imageModel, onImageModelChange, voiceProvider, onVoiceProviderChange, voice, onVoiceChange, elevenLabsVoices, elevenLabsVoiceId, onElevenLabsVoiceChange, onGenerateImage, onGenerateAudio, generating }) {
  const isGenerating = generating !== null;
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [enlargedUrl, setEnlargedUrl] = useState(null);
  const [translatedNarrations, setTranslatedNarrations] = useState([]);
  const [showTranslatedNarrations, setShowTranslatedNarrations] = useState(false);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [targetLanguageCode, setTargetLanguageCode] = useState(TRANSLATION_LANGUAGES[0]?.code ?? 'en');

  useEffect(() => {
    setTranslatedNarrations((prev) => (prev.length !== scenes.length ? [] : prev));
  }, [scenes.length]);

  const handleTranslate = async () => {
    setTranslationLoading(true);
    try {
      const narrations = scenes.map((s) => s.narration ?? '');
      const result = await translateNarrations(narrations, targetLanguageCode);
      setTranslatedNarrations(result?.length ? result : []);
      setShowTranslatedNarrations(true);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslationLoading(false);
    }
  };

  const applyTranslationToScript = () => {
    translatedNarrations.forEach((text, i) => {
      if (i < scenes.length) onUpdate(i, 'narration', text ?? scenes[i].narration ?? '');
    });
  };

  useEffect(() => {
    if (enlargedImage) {
      const url = URL.createObjectURL(enlargedImage);
      setEnlargedUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setEnlargedUrl(null);
  }, [enlargedImage]);

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex flex-wrap items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600">
        <span className="text-slate-400 text-sm">Translation:</span>
        <select
          value={targetLanguageCode}
          onChange={(e) => setTargetLanguageCode(e.target.value)}
          className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
        >
          {TRANSLATION_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label} ({l.continent})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleTranslate}
          disabled={translationLoading || !scenes.length}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium"
        >
          {translationLoading ? <AnimatedDots prefix="Translating" /> : 'Translate'}
        </button>
        {translatedNarrations.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
              <input
                type="radio"
                name="narrationView"
                checked={!showTranslatedNarrations}
                onChange={() => setShowTranslatedNarrations(false)}
              />
              Original
            </label>
            <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
              <input
                type="radio"
                name="narrationView"
                checked={showTranslatedNarrations}
                onChange={() => setShowTranslatedNarrations(true)}
              />
              Translated
            </label>
            <button
              type="button"
              onClick={applyTranslationToScript}
              className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm"
            >
              Apply translation to script
            </button>
          </>
        )}
      </div>
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-600 text-slate-400">
            <th className="py-3 px-2">#</th>
            <th className="py-3 px-2">Description</th>
            <th className="py-3 px-2">Narration</th>
            <th className="py-3 px-2">Image</th>
            <th className="py-3 px-2">Audio</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene, i) => (
            <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/30">
              <td className="py-2 px-2 text-slate-500">{scene.sceneNumber}</td>
              <td className="py-2 px-2">
                <textarea
                  value={scene.description}
                  onChange={(e) => onUpdate(i, 'description', e.target.value)}
                  className="w-full min-w-[200px] px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-200 text-xs resize-y min-h-[80px]"
                  rows={4}
                />
              </td>
              <td className="py-2 px-2">
                <textarea
                  value={showTranslatedNarrations && translatedNarrations[i] !== undefined ? translatedNarrations[i] : scene.narration}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (showTranslatedNarrations && translatedNarrations[i] !== undefined) {
                      setTranslatedNarrations((prev) => {
                        const next = [...prev];
                        next[i] = val;
                        return next;
                      });
                    } else {
                      onUpdate(i, 'narration', val);
                    }
                  }}
                  className="w-full min-w-[200px] px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-200 text-xs resize-y min-h-[80px]"
                  rows={4}
                />
              </td>
              <td className="py-2 px-2">
                <div className="space-y-1">
                  {scene.imageBlob ? (
                    <button
                      type="button"
                      onClick={() => setEnlargedImage(scene.imageBlob)}
                      className="block w-full text-left"
                    >
                      <SceneImage
                        blob={scene.imageBlob}
                        className="w-32 h-32 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </button>
                  ) : (
                    <div className="w-32 h-32 rounded bg-slate-700 flex items-center justify-center text-slate-500 text-xs">No image</div>
                  )}
                  <button
                    onClick={() => onGenerateImage(i)}
                    disabled={isGenerating}
                    className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-50"
                  >
                    {generating === i ? <AnimatedDots prefix="Generating" /> : 'Generate'}
                  </button>
                </div>
              </td>
              <td className="py-2 px-2">
                <div className="space-y-1">
                  <AudioPlayer blob={scene.audioBlob} />
                  <button
                    onClick={() => onGenerateAudio(i)}
                    disabled={isGenerating}
                    className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-50 block"
                  >
                    {generating === i ? <AnimatedDots prefix="Generating" /> : 'Generate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {enlargedImage && enlargedUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <button type="button" className="absolute top-4 right-4 text-white text-2xl hover:opacity-80" onClick={() => setEnlargedImage(null)} aria-label="Close">
            ×
          </button>
          <img src={enlargedUrl} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Image model:</span>
          <select
            value={imageModel}
            onChange={(e) => onImageModelChange(e.target.value)}
            className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Voice model:</span>
          <select
            value={voiceProvider}
            onChange={(e) => onVoiceProviderChange(e.target.value)}
            className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
          >
            <option value="gemini">Gemini</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
          {voiceProvider === 'gemini' && (
            <select
              value={voice}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm min-w-[220px]"
              title={GEMINI_TTS_VOICES.find((v) => v.id === voice)?.tone}
            >
              {GEMINI_TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id} title={`${v.tone} (${v.gender})`}>
                  {v.name} — {v.tone} ({v.gender})
                </option>
              ))}
            </select>
          )}
          {voiceProvider === 'elevenlabs' && (
            <select
              value={elevenLabsVoiceId}
              onChange={(e) => onElevenLabsVoiceChange?.(e.target.value)}
              className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm min-w-[200px]"
              disabled={!elevenLabsVoices?.length}
            >
              {!elevenLabsVoices?.length ? (
                <option value="">Loading voices...</option>
              ) : (
                elevenLabsVoices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
              )}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
