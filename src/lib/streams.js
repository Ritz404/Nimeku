// Dipakai route /api/stream dan halaman tonton (pemanasan). Hanya berjalan di server.
import { omnifyKey } from './key';
export const API = 'https://anime.omnifylabs.sbs';
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Link stream dari API terikat ke jaringan yang memintanya (error FORBIDDEN_STREAM bila beda).
// Karena itu link diminta DAN dipakai oleh server ini juga, tidak pernah diberikan ke browser.
const cache = new Map(); // "<episode>|<kualitas>|<server>|<format>" -> { url, format, exp }

// API mengirim 3 jenis stream: mp4 (file), hls (playlist tanpa ekstensi .m3u8), iframe (halaman embed)
export const fmtOf = (x) => String(x.format || '').toLowerCase() || (/\.m3u8/i.test(x.stream_url || '') ? 'hls' : 'mp4');
export const rank = (x) => ({ mp4: 0, hls: 1 }[fmtOf(x)] ?? 2);
export const serverNo = (x) => +String(x.server || '').match(/server\s*(\d+)/i)?.[1] || 1;
export const qualityOf = (x) => String(x.quality || '').toLowerCase();

// Data episode dari API disimpan 3 menit di memori server dan permintaan yang bersamaan digabung.
// Halaman tonton, proxy video, dan pemanasan episode berikutnya memakai data yang sama, jadi satu episode
// cukup satu permintaan ke API (sebelumnya bisa 2 sampai 3 kali, itu yang membuat pemutaran terasa lambat).
const epCache = new Map(); // episode -> { p: Promise, exp }
export function getEpisode(ep, force = false) {
  const hit = epCache.get(ep);
  if (!force && hit && hit.exp > Date.now()) return hit.p;
  const p = fetch(`${API}/anime/episode?id=${encodeURIComponent(ep)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json', 'X-API-Key': omnifyKey() },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  }).then(async (r) => {
    const j = await r.json().catch(() => null);
    const d = j?.data ?? j ?? null;
    // Jawaban error dari API (success:false, HTTP 4xx/5xx) bukan data episode: catat alasannya, jangan diteruskan
    if (!r.ok || j?.success === false) {
      const msg = j?.error?.message || j?.error || j?.message || '';
      console.warn(`[API] episode ${ep} ditolak: HTTP ${r.status}${msg ? ` - ${typeof msg === 'string' ? msg : JSON.stringify(msg)}` : ''}`);
      if (!(Array.isArray(d?.streams) && d.streams.length)) return null;
    }
    return d;
  });
  epCache.set(ep, { p, exp: Date.now() + 3 * 60 * 1000 });
  if (epCache.size > 100) epCache.delete(epCache.keys().next().value);
  // Jangan simpan hasil gagal atau tanpa stream supaya percobaan berikutnya mengambil data baru
  p.then((d) => { if (!(Array.isArray(d?.streams) && d.streams.length)) epCache.delete(ep); }, () => epCache.delete(ep));
  return p;
}

export async function resolveStream(ep, q, s, f, force = false) {
  const key = `${ep}|${q}|${s}|${f}`;
  const hit = cache.get(key);
  if (!force && hit && hit.exp > Date.now()) return hit;

  const data = await getEpisode(ep, force);
  const streams = data?.streams || [];
  const exact = streams.find((x) => qualityOf(x) === q && serverNo(x) === s && (!f || fmtOf(x) === f));
  const sameQ = streams.filter((x) => qualityOf(x) === q).sort((a, b) => rank(a) - rank(b));
  const pick = exact || sameQ[0] || [...streams].sort((a, b) => rank(a) - rank(b))[0];
  const url = pick?.stream_url || pick?.url;
  if (!url) throw new Error('stream tidak ditemukan');

  const out = { url, format: fmtOf(pick), exp: Date.now() + 4 * 60 * 1000 };
  cache.set(key, out);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return out;
}

// Batas waktu hanya untuk menunggu respons awal; setelah itu video boleh mengalir selama apa pun
export async function openUpstream(u, { range, signal, timeout = 60000 } = {}) {
  const headers = { 'User-Agent': UA, Referer: API + '/', Origin: API };
  if (/omnifylabs\.sbs$/i.test(new URL(u).hostname) && omnifyKey()) headers['X-API-Key'] = omnifyKey();
  if (range) headers.Range = range;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  signal?.addEventListener('abort', () => ctl.abort(), { once: true });
  try {
    return await fetch(u, { headers, redirect: 'follow', signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Pemanasan: permintaan pertama ke server video sering lambat. Dimulai saat halaman tonton dibuat,
// jadi ketika tombol putar ditekan server asal sudah siap.
export async function warmStream(ep, streams) {
  const playable = (streams || []).filter((x) => fmtOf(x) !== 'iframe');
  if (!playable.length) return;
  const pick = playable.find((x) => qualityOf(x) === '720p' && fmtOf(x) === 'mp4') || [...playable].sort((a, b) => rank(a) - rank(b))[0];
  const r = await resolveStream(ep, qualityOf(pick), serverNo(pick), fmtOf(pick));
  if (r.format !== 'mp4') return;
  const up = await openUpstream(r.url, { range: 'bytes=0-1' });
  await up.body?.cancel();
}
