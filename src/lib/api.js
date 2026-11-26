import { omnifyKey } from './key';
export const API_BASE = 'https://anime.omnifylabs.sbs';

// Alamat server API tidak boleh muncul di HTML/JS yang diterima pengunjung (misalnya saat halaman di-fetch bot
// atau dilihat lewat view-source). Semua alamat bergaya server itu diganti ke "/img/..." yang diteruskan
// diam-diam oleh server ini (lihat rewrites di next.config.mjs).
export function hideHost(v) {
  if (typeof v === 'string') return v.startsWith(`${API_BASE}/`) ? `/img${v.slice(API_BASE.length)}` : v;
  if (Array.isArray(v)) return v.map(hideHost);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = hideHost(v[k]); return o; }
  return v;
}

// Permintaan ke API dibatasi maksimal 6 sekaligus (halaman Jelajah/Jadwal meminta banyak data bersamaan; tanpa batas,
// API bisa menolak atau lambat sampai kehabisan waktu). Yang berlebih mengantre.
const MAX_ACTIVE = 8;
let active = 0;
const queue = [];
async function acquire() {
  if (active < MAX_ACTIVE) { active++; return; }
  await new Promise((r) => queue.push(r)); // slot diserahkan langsung oleh release()
}
function release() {
  const next = queue.shift();
  if (next) next(); else active--;
}

// Jawaban terakhir yang berhasil per alamat, dipakai bila API sedang gagal (lebih baik data agak lama daripada halaman kosong)
const lastGood = new Map();

// Cache di memori server: data yang masih segar dipakai langsung; data yang sudah basi tetap ditampilkan saat itu juga
// sambil diperbarui di belakang layar (stale-while-revalidate). Pengunjung hampir tidak pernah menunggu API yang lambat.
// Disimpan di globalThis supaya dipakai bersama oleh pemanasan awal (instrumentation) dan halaman.
const memo = (globalThis.__nimekuMemo ||= new Map()); // endpoint -> { data, at, p }

// Pengaman: bila API menolak berturut-turut (401/403/429: kunci salah, kuota habis, atau dibatasi), berhenti memanggilnya
// 1 menit. Data lama tetap ditampilkan dan API tidak dibombardir, yang justru bisa memperpanjang pemblokiran.
const brk = (globalThis.__nimekuBreak ||= { until: 0, fails: 0 });
export const apiPaused = () => Date.now() < brk.until;

async function pull(endpoint) {
  if (apiPaused()) return null;
  await acquire();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now();
      try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json',
            // Kunci API dibaca dari .env.local, hanya di sisi server (tidak ikut ke browser)
            'X-API-Key': omnifyKey(),
          },
          cache: 'no-store', // penyimpanan sementara diurus oleh memo di atas
          signal: AbortSignal.timeout(8000), // jangan menunggu selamanya
        });
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          brk.fails = 0;
          lastGood.set(endpoint, data);
          if (lastGood.size > 400) lastGood.delete(lastGood.keys().next().value);
          return data;
        }
        // Muncul di terminal server, berguna untuk mencari tahu kenapa data kosong (isi penolakan ikut dicatat)
        const why = res.status === 401 || res.status === 403 || res.status === 429 ? (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160) : '';
        console.warn(`[API] ${endpoint.split('?')[0]} -> HTTP ${res.status}${why ? `: ${why}` : ''}`);
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          if (++brk.fails >= 3 && !apiPaused()) {
            brk.until = Date.now() + 60 * 1000;
            brk.fails = 0;
            console.warn('[API] Ditolak berturut-turut. Periksa OMNIFY_API_KEY di .env.local atau kuota API. Permintaan dijeda 1 menit.');
          }
          break;
        }
        if (attempt === 0 && (res.status >= 500 || res.status === 429)) { await new Promise((r) => setTimeout(r, 400)); continue; }
        break;
      } catch {
        // Ulangi hanya jika gagalnya cepat; kalau sudah menunggu lama, menunggu lagi hanya membuat halaman makin lambat
        if (attempt === 0 && Date.now() - t0 < 3000) { await new Promise((r) => setTimeout(r, 300)); continue; }
        console.warn(`[API] ${endpoint.split('?')[0]} gagal`);
        break;
      }
    }
  } finally {
    release();
  }
  return null;
}

// revalidate = detik data dianggap segar (0 = selalu ambil baru).
// raw = true: kembalikan data apa adanya (khusus pemakaian di server, misalnya link stream)
export async function fetchOmnify(endpoint, revalidate = 0, raw = false) {
  const out = (d) => (raw ? d : hideHost(d));
  const fresh = (rec) => {
    // Satu permintaan bersama untuk semua yang menunggu alamat yang sama
    if (rec.p) return rec.p;
    rec.p = pull(endpoint).then((d) => {
      if (d != null) { rec.data = d; rec.at = Date.now(); }
      return d;
    }).finally(() => { rec.p = null; });
    return rec.p;
  };

  if (revalidate > 0) {
    let rec = memo.get(endpoint);
    if (!rec) {
      rec = { data: undefined, at: 0, p: null };
      memo.set(endpoint, rec);
      if (memo.size > 600) memo.delete(memo.keys().next().value);
    }
    if (rec.data !== undefined) {
      const age = Date.now() - rec.at;
      if (age < revalidate * 1000) return out(rec.data);
      // Basi: tampilkan yang lama sekarang, perbarui di belakang. Kalau sudah sangat tua, tunggu data baru.
      if (age < Math.max(revalidate * 6000, 30 * 60 * 1000)) { fresh(rec); return out(rec.data); }
    }
    const d = await fresh(rec);
    if (d != null) return out(d);
    return rec.data !== undefined ? out(rec.data) : lastGood.has(endpoint) ? out(lastGood.get(endpoint)) : null;
  }

  const d = await pull(endpoint);
  if (d != null) return out(d);
  return lastGood.has(endpoint) ? out(lastGood.get(endpoint)) : null;
}

// Ambil array dari bentuk respons apa pun: [..], {list:[..]}, {ongoing:[..]}, dst.
export function pickList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of ['list', 'ongoing', 'latest', 'results', 'items', 'anime', 'data']) {
      if (Array.isArray(data[k])) return data[k];
    }
    const first = Object.values(data).find(Array.isArray);
    if (first) return first;
  }
  return [];
}

export { normalizeItem } from './normalize';

// Hanya anime/donghua: buang musik/PV/iklan/komik dan genre dewasa
const DENY_TYPE = /^(music|pv|cm|commercial|promo|trailer|comic|manga|manhwa|manhua|novel)$/i;
const DENY_GENRE = /^(hentai|erotica|adult)/i;
export const isAdultGenre = (g) => DENY_GENRE.test(String(g || '').trim());
export function isAnime(a) {
  if (DENY_TYPE.test(String(a?.type || '').trim())) return false;
  if (Array.isArray(a?.genres) && a.genres.some(isAdultGenre)) return false;
  return true;
}
export const onlyAnime = (list) => list.filter(isAnime);

// Kumpulkan semua objek anime (punya id + title) dari struktur sebarang, termasuk yang bersarang per hari
export function collectAnime(data, out = [], seen = new Set()) {
  if (Array.isArray(data)) data.forEach((x) => collectAnime(x, out, seen));
  else if (data && typeof data === 'object') {
    if ((data.id || data.slug) && (data.title || data.name)) {
      const k = data.id || data.slug;
      if (!seen.has(k) && isAnime(data)) { seen.add(k); out.push(data); }
    } else Object.values(data).forEach((x) => collectAnime(x, out, seen));
  }
  return out;
}

// Daftar episode LENGKAP 1..N. API kadang hanya mengirim sebagian (mis. 1-13, 16, 393),
// jadi nomor yang terlewat diisi otomatis dengan pola <id>-ep-<nomor>.
export function buildEpisodes(detail, slug) {
  const raw = detail?.episodes;
  const ids = new Map();
  if (Array.isArray(raw)) {
    raw.forEach((e, i) => {
      const obj = e && typeof e === 'object';
      const n = Math.floor(Number(obj ? e.episode_number || e.number || e.episode : e)) || i + 1;
      ids.set(n, (obj && (e.episode_id || e.id || e.slug)) || `${slug}-ep-${n}`);
    });
  }
  const declared = Number(detail?.total_episodes || detail?.episode_count || detail?.current_episode || (typeof raw === 'number' ? raw : 0)) || 0;
  const max = Math.min(3000, Math.max(declared, ...ids.keys(), 1));
  return Array.from({ length: max }, (_, i) => ({ n: i + 1, id: ids.get(i + 1) || `${slug}-ep-${i + 1}`, label: `Episode ${i + 1}`, listed: ids.has(i + 1) }));
}

// ID video YouTube dari respons /anime/trailer (bentuk respons bisa berupa tautan atau field id)
export function youtubeId(data) {
  if (!data) return '';
  const m = JSON.stringify(data).match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return m[1];
  const id = typeof data === 'object' && (data.youtube_id || data.video_id || data.trailer_id);
  return /^[\w-]{11}$/.test(id || '') ? id : '';
}
