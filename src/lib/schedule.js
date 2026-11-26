// Jadwal rilis mingguan (hanya di server). Sumber utama: jadwal resmi dari API. Karena jadwal itu sering tidak memuat
// semua judul (terutama donghua), judul yang sedang tayang dari daftar "berjalan" dan "donghua" ikut ditambahkan:
// hari tayang diambil dari field hari bila ada, kalau tidak, diperkirakan dari hari dan jam update terakhir (ditandai est).
import { fetchOmnify, pickList, collectAnime, normalizeItem, onlyAnime } from '@/lib/api';

export const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const WORDS = { senin: 'senin', monday: 'senin', selasa: 'selasa', tuesday: 'selasa', rabu: 'rabu', wednesday: 'rabu', kamis: 'kamis', thursday: 'kamis', jumat: 'jumat', "jum'at": 'jumat', friday: 'jumat', sabtu: 'sabtu', saturday: 'sabtu', minggu: 'minggu', ahad: 'minggu', sunday: 'minggu' };
const WORD_RE = /\b(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const DAY_KEYS = /^(day|release_day|releaseday|broadcast_day|air_day|airing_day|schedule_day|hari|broadcast|schedule|release_schedule)$/i;
const FINISHED = /complete|tamat|finished|selesai/i;
const RECENT = 21 * 864e5; // judul yang tidak update lebih dari 3 minggu dianggap tidak sedang tayang mingguan

export const minutes = (t) => {
  const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const dayOfDate = (ts) => {
  const name = new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).toLowerCase().replace(/[^a-z]/g, '');
  return DAYS.includes(name) ? name : null;
};
const timeOfDate = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });

function explicitDay(a) {
  for (const k of Object.keys(a)) {
    if (!DAY_KEYS.test(k) || typeof a[k] !== 'string') continue;
    const m = a[k].match(WORD_RE);
    if (m) return WORDS[m[1].toLowerCase()] || null;
  }
  return null;
}

// Waktu tanpa zona dianggap WIB
function stamp(v) {
  if (!v) return NaN;
  const s = String(v).trim();
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}+07:00`);
}

const num = (v) => Number(String(v ?? '').replace(/[^\d.]/g, '')) || 0;
const genreName = (g) => (typeof g === 'string' ? g : g?.name || g?.title || '');

function row(a, extra = {}) {
  const n = normalizeItem(a);
  return {
    slug: n.slug, title: n.title, poster: n.poster, time: n.time || '', rating: n.rating || '',
    ep: a.current_episode || a.episode || n.episode || '',
    views: num(a.views), favorites: num(a.favorites),
    genres: (Array.isArray(a.genres) ? a.genres : []).map(genreName).filter(Boolean).slice(0, 3),
    est: false, ...extra,
  };
}

export async function loadSchedule() {
  const [perDay, ongoing, donghua] = await Promise.all([
    Promise.all(DAYS.map((d) => fetchOmnify(`/anime/schedule?day=${d}`, 600))),
    Promise.all([1, 2, 3].map((p) => fetchOmnify(`/anime/ongoing?page=${p}&per_page=50`, 600))),
    Promise.all([1, 2].map((p) => fetchOmnify(`/anime/donghua?page=${p}&per_page=50`, 600))),
  ]);

  const days = Object.fromEntries(DAYS.map((d) => [d, []]));
  const seen = new Set();
  perDay.forEach((data, i) => {
    for (const a of collectAnime(data)) {
      const r = row(a);
      if (!r.slug) continue;
      days[DAYS[i]].push(r);
      seen.add(r.slug);
    }
  });

  // Judul yang sedang tayang tetapi tidak ada di jadwal resmi
  const now = Date.now();
  for (const a of onlyAnime([...ongoing, ...donghua].flatMap((x) => pickList(x)))) {
    const slug = a.id || a.slug;
    if (!slug || seen.has(slug) || FINISHED.test(String(a.status || ''))) continue;
    let day = explicitDay(a);
    let est = false;
    let time = '';
    if (!day) {
      const ts = stamp(a.updated_at);
      if (!Number.isFinite(ts) || now - ts > RECENT || ts > now + 864e5) continue;
      day = dayOfDate(ts);
      time = timeOfDate(ts);
      est = true;
    }
    if (!day) continue;
    seen.add(slug);
    const r = row(a, { est });
    if (!r.time && time) r.time = time;
    days[day].push(r);
  }

  for (const d of DAYS) days[d].sort((x, y) => (minutes(x.time) ?? 9999) - (minutes(y.time) ?? 9999));
  return days;
}
