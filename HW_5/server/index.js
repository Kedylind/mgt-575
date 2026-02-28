require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;

async function connect() {
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log('MongoDB connected');
}

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:2rem;background:#00356b;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
        <div style="text-align:center">
          <h1>Chat API Server</h1>
          <p>Backend is running. Use the React app at <a href="http://localhost:3000" style="color:#ffd700">localhost:3000</a></p>
          <p><a href="/api/status" style="color:#ffd700">Check DB status</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = String(username).trim().toLowerCase();
    const existing = await db.collection('users').findOne({ username: name });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const first = firstName != null ? String(firstName).trim().slice(0, 100) : '';
    const last = lastName != null ? String(lastName).trim().slice(0, 100) : '';
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username: name,
      password: hashed,
      email: email ? String(email).trim().toLowerCase() : null,
      firstName: first,
      lastName: last,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    res.json({
      ok: true,
      username: name,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Image generation (Gemini — uses same API key as chat) ──────────────────────

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

app.post('/api/generate-image', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Image generation not configured (set REACT_APP_GEMINI_API_KEY or GEMINI_API_KEY)' });
  }
  try {
    const body = req.body || {};
    const prompt = (body.prompt || '').trim();
    const imageBase64 = body.imageBase64 || body.image;
    const mimeType = body.mimeType || 'image/png';
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const parts = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/png',
          data: imageBase64,
        },
      });
    }
    parts.push({
      text: `Edit or transform this image according to the following instruction. If no image is provided, generate a new image. Instruction: ${prompt}`,
    });

    // Match HW_4: only responseModalities; do NOT set responseMimeType (API allows only text/plain, application/json, etc.)
    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    // Best available for image generation: Gemini 2.5 Flash Image (state-of-the-art image model)
    const model = 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const genRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await genRes.json();
    if (data.error) {
      return res.status(genRes.status).json({ error: data.error.message || 'Gemini image generation failed' });
    }

    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts || [];
    const imagePart = content.find((p) => p.inlineData && p.inlineData.data);
    if (imagePart?.inlineData?.data) {
      return res.json({
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      });
    }
    return res.status(500).json({ error: 'No image in response. The model may not support image generation in this region or the request was blocked.' });
  } catch (err) {
    console.error('[generate-image]', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ── YouTube Channel Data (no API key: RSS feed + channel page parsing) ───────
// Main Veritasium channel ID (avoids locale redirect when user asks for @veritasium)
const VERITASIUM_MAIN_CHANNEL_ID = 'UCHnyfMqiRRG1u-2MsSQLbXA';

function parseChannelInput(input) {
  const s = (input || '').trim();
  const channelIdMatch = s.match(/(?:youtube\.com\/channel\/|^)(UC[\w-]{22})(?:\/|$)/i);
  if (channelIdMatch) return { type: 'id', value: channelIdMatch[1] };
  // Prefer handle from youtube.com/@handle so we don't capture "https" from a full URL
  const handleFromUrl = s.match(/youtube\.com\/@([\w.-]+)/i);
  if (handleFromUrl) return { type: 'handle', value: handleFromUrl[1] };
  // Bare handle only when the whole string is just @handle or handle (e.g. "@veritasium")
  const handleMatch = s.match(/^@?([\w.-]+)$/i);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  return null;
}

async function resolveChannelIdFromHandle(handle) {
  const url = `https://www.youtube.com/@${handle}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  const html = await res.text();
  const finalUrl = res.url || url;
  const idFromUrl = finalUrl.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (idFromUrl) return idFromUrl[1];
  const meta = html.match(/"channelId"\s*:\s*"(UC[\w-]{22})"/) || html.match(/"externalId"\s*:\s*"(UC[\w-]{22})"/);
  if (meta) return meta[1];
  return null;
}

function parseRssFeed(xml, maxVideos) {
  const videos = [];
  const channelTitleMatch = xml.match(/<author>\s*<name>([^<]+)<\/name>/);
  const channelTitle = channelTitleMatch ? channelTitleMatch[1].trim() : 'Channel';
  const entryBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  for (let i = 0; i < entryBlocks.length && videos.length < maxVideos; i++) {
    const entry = entryBlocks[i];
    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || entry.match(/<id>yt:video:([^<]+)<\/id>/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    if (!videoId) continue;
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    let title = titleMatch ? titleMatch[1].trim() : '';
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '');
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const publishedAt = publishedMatch ? publishedMatch[1] : '';
    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
    const link = linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${videoId}`;
    const mediaGroup = entry.match(/<media:group>([\s\S]*?)<\/media:group>/);
    let description = '';
    if (mediaGroup) {
      const descMatch = mediaGroup[1].match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/);
      if (descMatch) description = descMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 2000);
    }
    videos.push({
      videoId,
      title,
      description,
      publishedAt,
      duration: '',
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      url: link,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    });
  }
  return { channelTitle, videos };
}

// Format seconds as ISO 8601 duration (e.g. PT1M30S)
function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  let out = 'PT';
  if (h) out += `${h}H`;
  if (m) out += `${m}M`;
  if (s || !out) out += `${s}S`;
  return out === 'PT' ? 'PT0S' : out;
}

// Invidious instances (no API key) — try in order if one is down
const INVIDIOUS_BASES = [
  'https://inv.riverside.rocks',
  'https://invidious.flokinet.to',
  'https://vid.puffyan.us',
];

async function fetchVideoStatsFromInvidious(videoId, baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/v1/videos/${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YouTubeChannelDownload/1.0)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const viewCount = typeof data.viewCount === 'number' ? data.viewCount : parseInt(data.viewCount, 10);
    const likeCount = typeof data.likeCount === 'number' ? data.likeCount : parseInt(data.likeCount, 10);
    const lengthSeconds = data.lengthSeconds != null ? data.lengthSeconds : 0;
    // Some Invidious instances include commentCount on the video object
    let commentCount = typeof data.commentCount === 'number' ? data.commentCount : (parseInt(data.commentCount, 10) || 0);
    try {
      const cr = await fetch(`${baseUrl}/api/v1/comments/${videoId}?sort_by=top`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YouTubeChannelDownload/1.0)' },
      });
      if (cr.ok) {
        const commentsData = await cr.json();
        if (commentsData.commentCount != null) commentCount = commentsData.commentCount;
      }
    } catch (_) {}
    return {
      viewCount: Number.isNaN(viewCount) ? 0 : viewCount,
      likeCount: Number.isNaN(likeCount) ? 0 : likeCount,
      commentCount,
      lengthSeconds: Number.isNaN(lengthSeconds) ? 0 : lengthSeconds,
      duration: formatDuration(lengthSeconds),
    };
  } catch (_) {
    return null;
  }
}

// Fallback: scrape YouTube watch page for view count (and like count if present)
async function fetchVideoStatsFromYouTubePage(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    let viewCount = 0;
    let likeCount = 0;
    let commentCount = 0;
    let lengthSeconds = 0;
    const viewMatch = html.match(/"viewCount"\s*:\s*"([^"]+)"/) || html.match(/viewCount["\s:]+(\d+)/);
    if (viewMatch) viewCount = parseInt(viewMatch[1].replace(/\D/g, ''), 10) || 0;
    const likeMatch = html.match(/"likeCount"\s*:\s*"([^"]+)"/) || html.match(/likeCount["\s:]+(\d+)/);
    if (likeMatch) likeCount = parseInt(likeMatch[1].replace(/\D/g, ''), 10) || 0;
    const commentMatch = html.match(/"commentCount"\s*:\s*"([^"]+)"/) || html.match(/commentCount["\s:]+(\d+)/);
    if (commentMatch) commentCount = parseInt(String(commentMatch[1]).replace(/\D/g, ''), 10) || 0;
    const lengthMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/) || html.match(/lengthSeconds["\s:]+(\d+)/);
    if (lengthMatch) lengthSeconds = parseInt(lengthMatch[1], 10) || 0;
    return {
      viewCount: Number.isNaN(viewCount) ? 0 : viewCount,
      likeCount: Number.isNaN(likeCount) ? 0 : likeCount,
      commentCount: Number.isNaN(commentCount) ? 0 : commentCount,
      lengthSeconds: Number.isNaN(lengthSeconds) ? 0 : lengthSeconds,
      duration: formatDuration(lengthSeconds),
    };
  } catch (_) {
    return null;
  }
}

async function enrichVideoWithStats(video) {
  for (const base of INVIDIOUS_BASES) {
    const stats = await fetchVideoStatsFromInvidious(video.videoId, base);
    if (stats) {
      video.viewCount = stats.viewCount;
      video.likeCount = stats.likeCount;
      video.commentCount = stats.commentCount;
      video.duration = stats.duration;
      if (stats.lengthSeconds) video.duration_seconds = stats.lengthSeconds;
      return;
    }
  }
  const scraped = await fetchVideoStatsFromYouTubePage(video.videoId);
  if (scraped) {
    video.viewCount = scraped.viewCount;
    video.likeCount = scraped.likeCount;
    video.commentCount = scraped.commentCount;
    video.duration = scraped.duration;
    if (scraped.lengthSeconds) video.duration_seconds = scraped.lengthSeconds;
  }
}

// Enrich up to maxVideos with stats, with concurrency limit
async function enrichVideosWithStats(videos, concurrency = 3) {
  const results = [...videos];
  for (let i = 0; i < results.length; i += concurrency) {
    const chunk = results.slice(i, i + concurrency);
    await Promise.all(chunk.map((v) => enrichVideoWithStats(v)));
  }
  return results;
}

app.get('/api/youtube/channel', async (req, res) => {
  try {
    const channelUrl = (req.query.channelUrl || req.query.channel || '').trim();
    const maxVideos = Math.min(100, Math.max(1, parseInt(req.query.maxVideos || '10', 10) || 10));
    const parsed = parseChannelInput(channelUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid channel URL. Use e.g. https://www.youtube.com/@veritasium or https://www.youtube.com/channel/UC...' });
    }

    let channelId;
    if (parsed.type === 'id') {
      channelId = parsed.value;
    } else if (parsed.type === 'handle' && parsed.value.toLowerCase() === 'veritasium') {
      channelId = VERITASIUM_MAIN_CHANNEL_ID;
    } else {
      channelId = await resolveChannelIdFromHandle(parsed.value);
      if (!channelId) {
        return res.status(404).json({ error: 'Could not resolve channel ID for handle: @' + parsed.value });
      }
    }

    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const rssRes = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/atom+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!rssRes.ok) {
      if (rssRes.status === 404 && parsed.type === 'handle' && parsed.value.toLowerCase() === 'veritasium' && maxVideos === 10) {
        const publicPath = path.join(__dirname, '..', 'public', 'veritasium-channel-10.json');
        try {
          const existing = fs.readFileSync(publicPath, 'utf8');
          const data = JSON.parse(existing);
          if (data.videos && data.videos.length > 0) {
            await enrichVideosWithStats(data.videos, 3);
            return res.json(data);
          }
        } catch (_) {}
      }
      const errMsg = rssRes.status === 404
        ? 'YouTube returned 404 for the channel feed (feed may be temporarily unavailable).'
        : rssRes.status === 403
          ? 'YouTube may be blocking this request from your network.'
          : `HTTP ${rssRes.status}`;
      return res.status(502).json({ error: `Could not fetch channel feed (${rssRes.status}). ${errMsg}` });
    }
    const xml = await rssRes.text();
    const { channelTitle, videos } = parseRssFeed(xml, maxVideos);

    await enrichVideosWithStats(videos, 3);

    const payload = { channelId, channelTitle, videos };
    res.json(payload);
  } catch (err) {
    console.error('[YouTube RSS]', err);
    res.status(500).json({ error: err.message || 'Channel fetch failed' });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
    };
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: new ObjectId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

connect()
  .then(() => {
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
