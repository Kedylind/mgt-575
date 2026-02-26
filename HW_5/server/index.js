require('dotenv').config();
const express = require('express');
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

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseMimeType: 'image/png',
      },
    };

    const model = 'gemini-2.0-flash-exp-image-generation';
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

// ── YouTube Channel Data ─────────────────────────────────────────────────────

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;

function parseChannelInput(input) {
  const s = (input || '').trim();
  const channelIdMatch = s.match(/^(UC[\w-]{22})$/);
  if (channelIdMatch) return { type: 'id', value: channelIdMatch[1] };
  const urlMatch = s.match(/(?:youtube\.com\/channel\/)(UC[\w-]{22})/i);
  if (urlMatch) return { type: 'id', value: urlMatch[1] };
  const handleMatch = s.match(/(?:youtube\.com\/@|^@?)([\w.-]+)/i);
  if (handleMatch) return { type: 'handle', value: handleMatch[1].startsWith('@') ? handleMatch[1] : `@${handleMatch[1]}` };
  return null;
}

app.get('/api/youtube/channel', async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    return res.status(503).json({ error: 'YouTube API key not configured (YOUTUBE_API_KEY)' });
  }
  try {
    const channelUrl = (req.query.channelUrl || req.query.channel || '').trim();
    const maxVideos = Math.min(100, Math.max(1, parseInt(req.query.maxVideos || '10', 10) || 10));
    const parsed = parseChannelInput(channelUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid channel URL or ID. Use e.g. https://www.youtube.com/@veritasium or a channel ID.' });
    }

    let channelId, channelTitle;
    const base = 'https://www.googleapis.com/youtube/v3';

    if (parsed.type === 'id') {
      const r = await fetch(
        `${base}/channels?part=snippet,contentDetails&id=${parsed.value}&key=${YOUTUBE_API_KEY}`
      );
      const data = await r.json();
      const ch = data.items?.[0];
      if (!ch) return res.status(404).json({ error: 'Channel not found' });
      channelId = ch.id;
      channelTitle = ch.snippet?.title || '';
    } else {
      const r = await fetch(
        `${base}/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(parsed.value)}&key=${YOUTUBE_API_KEY}`
      );
      const data = await r.json();
      const ch = data.items?.[0];
      if (!ch) return res.status(404).json({ error: 'Channel not found for handle: ' + parsed.value });
      channelId = ch.id;
      channelTitle = ch.snippet?.title || '';
    }

    const uploadsPlaylistId = (await (async () => {
      const r = await fetch(
        `${base}/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`
      );
      const d = await r.json();
      return d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    })());
    if (!uploadsPlaylistId) {
      return res.status(404).json({ error: 'Uploads playlist not found' });
    }

    const videoIds = [];
    let nextPageToken = '';
    while (videoIds.length < maxVideos) {
      const r = await fetch(
        `${base}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${Math.min(50, maxVideos - videoIds.length)}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}&key=${YOUTUBE_API_KEY}`
      );
      const data = await r.json();
      const items = data.items || [];
      for (const it of items) {
        if (it.contentDetails?.videoId) videoIds.push(it.contentDetails.videoId);
      }
      nextPageToken = data.nextPageToken || '';
      if (!nextPageToken || items.length === 0) break;
    }
    const limited = videoIds.slice(0, maxVideos);

    const videos = [];
    for (let i = 0; i < limited.length; i += 50) {
      const batch = limited.slice(i, i + 50);
      const r = await fetch(
        `${base}/videos?part=snippet,contentDetails,statistics&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`
      );
      const data = await r.json();
      for (const v of data.items || []) {
        const vid = v.id;
        const sn = v.snippet || {};
        const stat = v.statistics || {};
        const dur = v.contentDetails?.duration || '';
        videos.push({
          videoId: vid,
          title: sn.title || '',
          description: (sn.description || '').slice(0, 500),
          publishedAt: sn.publishedAt || '',
          duration: dur,
          viewCount: parseInt(stat.viewCount || '0', 10),
          likeCount: parseInt(stat.likeCount || '0', 10),
          commentCount: parseInt(stat.commentCount || '0', 10),
          url: `https://www.youtube.com/watch?v=${vid}`,
          thumbnailUrl: sn.thumbnails?.maxres?.url || sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
        });
      }
    }

    res.json({ channelId, channelTitle, videos });
  } catch (err) {
    console.error('[YouTube]', err);
    res.status(500).json({ error: err.message || 'YouTube API error' });
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
