import React, { useState, useEffect } from 'react';
import { IMAGE_MODELS, buildScriptContext, generateYouTubeTitle, generateYouTubeDescription, generateYouTubeThumbnail } from '../services/gemini';
import AnimatedDots from './AnimatedDots';

export default function YouTubeMetadata({
  scenes,
  anchorImages,
  title,
  description,
  thumbnailBlob,
  onTitleChange,
  onDescriptionChange,
  onThumbnailChange,
  defaultImageModel,
}) {
  const [titleLoading, setTitleLoading] = useState(false);
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailModel, setThumbnailModel] = useState(defaultImageModel || IMAGE_MODELS[0]?.id);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);

  useEffect(() => {
    if (thumbnailBlob) {
      const url = URL.createObjectURL(thumbnailBlob);
      setThumbnailUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setThumbnailUrl(null);
  }, [thumbnailBlob]);

  const scriptContext = buildScriptContext(scenes);

  const handleGenerateTitle = async () => {
    setTitleLoading(true);
    try {
      const t = await generateYouTubeTitle(scriptContext, anchorImages);
      onTitleChange?.(t);
    } catch (err) {
      console.error('Generate title failed:', err);
    } finally {
      setTitleLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    setDescriptionLoading(true);
    try {
      const d = await generateYouTubeDescription(scriptContext, anchorImages);
      onDescriptionChange?.(d);
    } catch (err) {
      console.error('Generate description failed:', err);
    } finally {
      setDescriptionLoading(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    setThumbnailLoading(true);
    try {
      const blob = await generateYouTubeThumbnail(scriptContext, anchorImages, thumbnailModel);
      onThumbnailChange?.(blob);
    } catch (err) {
      console.error('Generate thumbnail failed:', err);
    } finally {
      setThumbnailLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600 space-y-4">
      <h3 className="text-lg font-semibold text-slate-200">YouTube Metadata</h3>

      <div>
        <label className="block text-slate-400 text-sm mb-1">Title</label>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder="Video title"
            className="flex-1 min-w-[200px] px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-200 text-sm"
          />
          <button
            type="button"
            onClick={handleGenerateTitle}
            disabled={titleLoading || !scenes?.length}
            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm font-medium"
          >
            {titleLoading ? <AnimatedDots prefix="Generating" /> : 'Generate Title'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1">Description</label>
        <div className="flex flex-col gap-2">
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange?.(e.target.value)}
            placeholder="Video description"
            rows={4}
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-200 text-sm resize-y"
          />
          <button
            type="button"
            onClick={handleGenerateDescription}
            disabled={descriptionLoading || !scenes?.length}
            className="self-start px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm font-medium"
          >
            {descriptionLoading ? <AnimatedDots prefix="Generating" /> : 'Generate Description'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1">Thumbnail</label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={thumbnailModel}
            onChange={(e) => setThumbnailModel(e.target.value)}
            className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerateThumbnail}
            disabled={thumbnailLoading || !scenes?.length}
            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm font-medium"
          >
            {thumbnailLoading ? <AnimatedDots prefix="Generating" /> : 'Generate Image'}
          </button>
        </div>
        {thumbnailUrl && (
          <div className="mt-2">
            <img src={thumbnailUrl} alt="Thumbnail" className="max-w-xs max-h-48 object-contain rounded border border-slate-600" />
          </div>
        )}
      </div>
    </div>
  );
}
