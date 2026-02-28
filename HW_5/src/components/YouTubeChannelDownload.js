import { useState } from 'react';
import './YouTubeChannelDownload.css';

const API = process.env.REACT_APP_API_URL || '';

export default function YouTubeChannelDownload() {
  const [channelUrl, setChannelUrl] = useState('https://www.youtube.com/@veritasium');
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleDownload = async () => {
    setError('');
    setResult(null);
    setLoading(true);
    setProgress(10);
    try {
      setProgress(30);
      const res = await fetch(
        `${API}/api/youtube/channel?channelUrl=${encodeURIComponent(channelUrl.trim())}&maxVideos=${Math.min(100, Math.max(1, maxVideos))}`
      );
      setProgress(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleDownloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.channelTitle ? `${result.channelTitle.replace(/[^a-z0-9]/gi, '_')}-channel-${(result.videos || []).length}.json` : 'channel-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="youtube-download">
      <div className="youtube-download-card">
        <h1 className="youtube-download-title">YouTube Channel Download</h1>
        <p className="youtube-download-subtitle">Fetch channel metadata and video list as JSON (no API key required)</p>

        <div className="youtube-download-form">
          <label>
            <span>Channel URL</span>
            <input
              type="text"
              placeholder="https://www.youtube.com/@veritasium"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleDownload())}
              disabled={loading}
            />
          </label>
          <label>
            <span>Max videos</span>
            <input
              type="number"
              min={1}
              max={100}
              value={maxVideos}
              onChange={(e) => setMaxVideos(parseInt(e.target.value, 10) || 10)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleDownload())}
              disabled={loading}
            />
          </label>
          <button
            type="button"
            className="youtube-download-btn"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDownload();
            }}
          >
            {loading ? 'Downloading…' : 'Download Channel Data'}
          </button>
        </div>

        {loading && (
          <div className="youtube-progress-wrap">
            <div className="youtube-progress-bar">
              <div className="youtube-progress-fill" style={{ width: progress ? `${progress}%` : '30%' }} />
            </div>
            <span className="youtube-progress-label">
              {progress < 50 ? 'Fetching channel…' : progress < 90 ? 'Fetching videos…' : 'Finishing…'}
            </span>
          </div>
        )}

        {error && (
          <div className="youtube-error">
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="youtube-result">
            <h2>Result</h2>
            <p className="youtube-result-meta">
              <strong>{result.channelTitle}</strong> · {(result.videos || []).length} videos
            </p>
            {(result.videos || []).length > 0 && (
              <div className="youtube-result-preview">
                <span>Preview (first 3):</span>
                <ul>
                  {(result.videos || []).slice(0, 3).map((v, i) => (
                    <li key={v.videoId || i}>{v.title || v.videoId}</li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className="youtube-download-json-btn" onClick={handleDownloadJson}>
              Download JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
