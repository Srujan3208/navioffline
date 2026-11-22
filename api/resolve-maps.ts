export default async function handler(req: any, res: any) {
  const raw = String(req.query?.url || '');
  if (!raw || !/^https?:\/\//i.test(raw)) return res.status(400).json({ error: 'Provide a valid Maps URL' });
  try {
    const response = await fetch(raw, { redirect: 'follow', headers: { 'User-Agent': 'NaviOffline/1.0 location-link resolver' } });
    const finalUrl = response.url || raw;
    const text = finalUrl + ' ' + (await response.text()).slice(0, 4000);
    const patterns = [
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /[!@](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const lat = Number(m[1]), lng = Number(m[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return res.status(200).json({ url: finalUrl, lat, lng, name: 'Google Maps location' });
      }
    }
    const u = new URL(finalUrl);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('destination') || u.pathname.split('/place/')[1]?.split('/')[0]?.replaceAll('+', ' ');
    if (q) {
      const geo = await fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=1&lang=en');
      const j = await geo.json();
      const f = j.features?.[0];
      if (f) return res.status(200).json({ url: finalUrl, name: f.properties.name || q, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
    }
    return res.status(200).json({ url: finalUrl, unresolved: true, name: 'Google Maps location' });
  } catch (e: any) {
    return res.status(502).json({ error: 'Could not resolve this Maps link. Try a full Google Maps URL.' });
  }
}