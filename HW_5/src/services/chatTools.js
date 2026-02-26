// YouTube / channel JSON tools — declarations for Gemini and client-side executors

export const YOUTUBE_TOOL_DECLARATIONS = [
  {
    name: 'compute_stats_json',
    description:
      'Compute mean, median, standard deviation, minimum, and maximum for a numeric field in the loaded channel JSON (e.g. view_count, like_count, comment_count, viewCount, likeCount, duration). Use when the user asks for statistics, average, or distribution of a numeric column.',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: {
          type: 'STRING',
          description: 'Numeric field name in the channel data (e.g. viewCount, likeCount, commentCount, duration_seconds). Use exact key from the JSON.',
        },
      },
      required: ['field'],
    },
  },
  {
    name: 'play_video',
    description:
      'Open or play a YouTube video from the loaded channel data. User can ask by title (e.g. "play the asbestos video"), by position (e.g. "play the first video"), or "most viewed". Returns title and thumbnail; app shows a clickable card that opens the video in a new tab.',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'One of: "by_title", "by_ordinal", "most_viewed"',
        },
        titleKeyword: { type: 'STRING', description: 'For by_title: keyword or phrase from the video title (e.g. "asbestos")' },
        ordinal: { type: 'NUMBER', description: 'For by_ordinal: 1-based index (1 = first video)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description:
      'Plot a numeric field (e.g. viewCount, likeCount, commentCount) vs time (e.g. publishedAt) for the videos in the loaded channel JSON. Use when the user asks for a time series, trend, or "X over time".',
    parameters: {
      type: 'OBJECT',
      properties: {
        metric: {
          type: 'STRING',
          description: 'Numeric field for y-axis (e.g. viewCount, likeCount, commentCount)',
        },
        timeField: {
          type: 'STRING',
          description: 'Field for x-axis (default publishedAt). Use publishedAt or similar date key.',
        },
      },
      required: ['metric'],
    },
  },
  {
    name: 'generateImage',
    description:
      'Generate an image from a text prompt and an anchor/reference image provided by the user. Use when the user asks to create, edit, or generate an image based on a description and an uploaded image.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description: 'Text description for the image to generate or the edit to apply (e.g. "make this look like a painting")',
        },
      },
      required: ['prompt'],
    },
  },
];

// Normalize channel JSON to an array of video objects with consistent field names
function getVideosArray(jsonData) {
  if (!jsonData) return [];
  const arr = Array.isArray(jsonData) ? jsonData : (jsonData.videos || jsonData.items || []);
  return arr.map((v) => ({
    ...v,
    videoId: v.videoId || v.id,
    title: v.title || '',
    viewCount: v.viewCount ?? v.view_count ?? 0,
    likeCount: v.likeCount ?? v.like_count ?? 0,
    commentCount: v.commentCount ?? v.comment_count ?? 0,
    publishedAt: v.publishedAt ?? v.published_at ?? v.release_date ?? '',
    thumbnailUrl: v.thumbnailUrl || v.thumbnail_url || (v.videoId ? `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg` : ''),
    url: v.url || (v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : ''),
  }));
}

// Parse ISO 8601 duration (PT1H2M10S) to seconds
function parseDuration(s) {
  if (typeof s === 'number' && !Number.isNaN(s)) return s;
  if (!s || typeof s !== 'string') return 0;
  const match = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, sec] = match;
  return (parseInt(h || 0, 10) * 3600) + (parseInt(m || 0, 10) * 60) + parseInt(sec || 0, 10);
}

// Resolve numeric field (support both camelCase and snake_case)
function getNumericValues(videos, field) {
  const key = field in (videos[0] || {})
    ? field
    : Object.keys(videos[0] || {}).find((k) => k.toLowerCase().replace(/_/g, '') === field.toLowerCase().replace(/_/g, '')) || field;
  return videos.map((v) => {
    let val = v[key];
    if (key === 'duration' || key === 'duration_seconds') val = parseDuration(val);
    else val = typeof val === 'number' ? val : parseFloat(val);
    return val;
  }).filter((n) => !Number.isNaN(n));
}

function median(sorted) {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function executeYouTubeTool(toolName, args, jsonData, anchorImageBase64 = null, anchorMimeType = null) {
  const videos = getVideosArray(jsonData);

  switch (toolName) {
    case 'compute_stats_json': {
      const field = args.field || 'viewCount';
      const vals = getNumericValues(videos, field);
      if (!vals.length) {
        return { error: `No numeric values for field "${field}". Available keys: ${videos[0] ? Object.keys(videos[0]).join(', ') : 'none'}` };
      }
      const sorted = [...vals].sort((a, b) => a - b);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      return {
        field: args.field,
        mean: +mean.toFixed(4),
        median: +median(sorted).toFixed(4),
        std: +Math.sqrt(variance).toFixed(4),
        min: Math.min(...vals),
        max: Math.max(...vals),
        count: vals.length,
      };
    }

    case 'play_video': {
      const selector = (args.selector || 'most_viewed').toLowerCase();
      let chosen = null;
      if (selector === 'most_viewed') {
        const sorted = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        chosen = sorted[0];
      } else if (selector === 'by_ordinal') {
        const idx = Math.max(0, (args.ordinal || 1) - 1);
        const byDate = [...videos].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
        chosen = byDate[idx];
      } else if (selector === 'by_title' && args.titleKeyword) {
        const kw = (args.titleKeyword || '').toLowerCase();
        chosen = videos.find((v) => (v.title || '').toLowerCase().includes(kw));
      }
      if (!chosen) {
        return { error: `No video found for selector: ${selector}${args.titleKeyword ? ` keyword "${args.titleKeyword}"` : ''}` };
      }
      return {
        _playVideo: true,
        videoId: chosen.videoId,
        title: chosen.title,
        thumbnailUrl: chosen.thumbnailUrl,
        url: chosen.url,
      };
    }

    case 'plot_metric_vs_time': {
      const metric = args.metric || 'viewCount';
      const timeField = args.timeField || 'publishedAt';
      const key = Object.keys(videos[0] || {}).find((k) => k.toLowerCase() === timeField.toLowerCase()) || timeField;
      const points = videos
        .map((v) => ({
          date: v[key] || v.publishedAt || '',
          value: getNumericValues([v], metric)[0] ?? 0,
        }))
        .filter((p) => p.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      if (!points.length) {
        return { error: `No data for metric "${metric}" vs "${timeField}"` };
      }
      return {
        _chartType: 'metric_vs_time',
        data: points,
        metric,
        timeField: key,
      };
    }

    case 'generateImage':
      // Actual execution is done in Chat: call API with prompt + anchorImage, then return result to model
      return { _generateImage: true, prompt: args.prompt, anchorImageBase64, anchorMimeType };

    default:
      return { error: `Unknown YouTube tool: ${toolName}` };
  }
}
