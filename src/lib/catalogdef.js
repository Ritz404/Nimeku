// Bagian daftar anime yang aman dipakai di browser (tanpa alamat API)
export const TABS_UI = [
  { k: 'populer', label: 'Populer' },
  { k: 'hariini', label: 'Hari ini' },
  { k: 'mingguan', label: 'Mingguan' },
  { k: 'bulanan', label: 'Bulanan' },
  { k: 'terbaru', label: 'Terbaru' },
  { k: 'berjalan', label: 'Berjalan' },
  { k: 'tamat', label: 'Tamat' },
  { k: 'rekomendasi', label: 'Rekomendasi' },
  { k: 'film', label: 'Film' },
  { k: 'donghua', label: 'Donghua' },
  { k: 'semua', label: 'Semua A-Z' },
];
export const STATUS = [['', 'Semua status'], ['ongoing', 'Berjalan'], ['completed', 'Tamat']];
export const TYPES = [['', 'Semua jenis'], ['anime', 'Anime'], ['donghua', 'Donghua'], ['movie', 'Film']];

// Rapikan parameter (dari URL atau dari tombol) menjadi bentuk baku
export function normParams(sp = {}) {
  const q = String(sp.q || '').trim().slice(0, 100);
  const g = String(sp.genre || '').trim();
  const genre = /^[\p{L}\p{N}_.+-]{1,60}$/u.test(g) ? g : '';
  const status = STATUS.some(([v]) => v && v === sp.status) ? sp.status : '';
  const type = TYPES.some(([v]) => v && v === sp.type) ? sp.type : '';
  const tab = (TABS_UI.find((t) => t.k === sp.tab) || TABS_UI[0]).k;
  const filtering = !q && !!(status || type);
  return { q, genre, status, type, tab, filtering, plain: !q && !genre && !filtering };
}

// Parameter untuk /api/list dan URL halaman
export function qsOf(p) {
  return new URLSearchParams({
    ...(p.q && { q: p.q }),
    ...(p.genre && { genre: p.genre }),
    ...(p.status && { status: p.status }),
    ...(p.type && { type: p.type }),
    ...(p.plain && { tab: p.tab }),
  }).toString();
}
