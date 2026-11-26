// Pengaturan daftar anime/donghua yang dipakai halaman Jelajah, Donghua, dan /api/list (hanya di server)
import { fetchOmnify, pickList, onlyAnime } from '@/lib/api';
import { TABS_UI, STATUS, TYPES, normParams, qsOf } from '@/lib/catalogdef';

export const PAGE_SIZE = 30; // item per permintaan ke API; harus sama di server dan saat memuat lanjutan
export const FIRST_PAGES = 2; // halaman yang dimuat langsung; sisanya menyusul saat digulir


export { STATUS, TYPES };
const PATHS = {
  populer: '/anime/popular?period=all',
  hariini: '/anime/popular?period=today',
  mingguan: '/anime/popular?period=weekly',
  bulanan: '/anime/popular?period=monthly',
  terbaru: '/anime/latest?',
  berjalan: '/anime/ongoing?',
  tamat: '/anime/completed?',
  rekomendasi: '/anime/recommendations?',
  film: '/anime/movies?',
  donghua: '/anime/donghua?',
  semua: '/anime/list?',
};
export const TABS = TABS_UI.map((t) => ({ ...t, path: PATHS[t.k] }));

// Ubah parameter URL menjadi alamat endpoint yang aman (hanya nilai yang dikenal)
export function parseCatalog(sp = {}) {
  const p = normParams(sp);
  const { q, genre, status, type, tab, filtering } = p;
  let endpoint;
  if (q) endpoint = `/anime/search?q=${encodeURIComponent(q)}`;
  else if (filtering) {
    const f = new URLSearchParams({ ...(genre && { genre }), ...(status && { status }), ...(type && { type }) });
    endpoint = `/anime/filter?${f}`;
  } else if (genre) endpoint = `/anime/genre/${encodeURIComponent(genre)}?`;
  else endpoint = PATHS[tab];
  const sep = endpoint.endsWith('?') ? '' : '&';
  return { ...p, endpoint, sep, qs: qsOf(p) };
}

export const pageUrl = (c, page) => `${c.endpoint}${c.sep}page=${page}&per_page=${PAGE_SIZE}`;

// Halaman-halaman pertama diminta bersamaan, digabung, dan duplikatnya dibuang
export async function firstPages(c) {
  const chunks = await Promise.all(Array.from({ length: FIRST_PAGES }, (_, i) => fetchOmnify(pageUrl(c, i + 1), c.q ? 0 : 300)));
  const seen = new Set();
  return onlyAnime(chunks.flatMap((x) => pickList(x))).filter((a) => {
    const id = a.id || a.slug || a.title;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
