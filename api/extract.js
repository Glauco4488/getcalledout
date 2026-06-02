// api/extract.js
const { YoutubeTranscript } = require('youtube-transcript');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

function getYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.query.url || (req.body && req.body.url) || '').trim();
  const lang = (req.query.lang || 'it').trim();
  if (!url) return res.status(400).json({ error: 'URL mancante' });

  try {
    // --- Caso 1: link YouTube -> trascrizione ---
    const ytId = getYouTubeId(url);
    if (ytId) {
      let items;
      try {
        items = await YoutubeTranscript.fetchTranscript(ytId, { lang });
      } catch {
        items = await YoutubeTranscript.fetchTranscript(ytId);
      }
      const text = items.map(t => t.text).join(' ');
      return res.status(200).json({ source: 'youtube', title: 'Video YouTube', text });
    }

    // --- Caso 2: qualsiasi altro link -> testo dell'articolo ---
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GetCalledOut/1.0)' }
    });
    const html = await r.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();

    if (!article || !article.textContent || article.textContent.trim().length < 100) {
      return res.status(422).json({ error: 'Impossibile estrarre testo leggibile da questo link' });
    }

    return res.status(200).json({
      source: 'article',
      title: article.title || '',
      text: article.textContent.trim()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Estrazione fallita: ' + (err.message || 'errore sconosciuto') });
  }
};