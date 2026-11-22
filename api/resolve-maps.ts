export default async function handler(req: any, res: any) {
  const raw = String(req.query?.url || '');
  if (!raw || !/^https?:\/\//i.test(raw)) return res.status(400).json({ error: 'Provide a valid Maps URL' });
  if (!/(google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(raw)) return res.status(400).json({ error: 'Only Google Maps links are supported' });
  try {
    const clean = raw.replace(/[?&]g_st=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
    const response = await fetch(clean, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36', 'Accept': 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(12000) });
    const finalUrl = response.url || clean;
    const html = await response.text();
    const text = finalUrl + ' ' + html.slice(0, 12000);
    const patterns = [
      /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
      /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
      /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
      /center=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const lat = Number(m[1]), lng = Number(m[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return res.status(200).json({ url: finalUrl, lat, lng, name: 'Google Maps location' });
      }
    }
    const u = new URL(finalUrl);
    let q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('destination');
    if (!q) {
      const place = u.pathname.match(/\/place\/([^/]+)/);
      if (place) q = decodeURIComponent(place[1].replaceAll('+', ' '));
    }
    if (q) {
      const geo = await fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=1&lang=en', { signal: AbortSignal.timeout(8000) });
      const j = await geo.json();
      const f = j.features?.[0];
      if (f) return res.status(200).json({ url: finalUrl, name: f.properties.name || q, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
    }
    return res.status(200).json({ url: finalUrl, unresolved: true, name: 'Google Maps location', message: 'Google did not expose coordinates. Open the link and copy its full Maps URL or coordinates.' });
  } catch {
    return res.status(200).json({ unresolved: true, name: 'Google Maps location', message: 'Google Maps short-link resolution timed out or was blocked.' });
  }
}