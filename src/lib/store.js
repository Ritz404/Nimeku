'use client';

import { useEffect, useState } from 'react';

// Data pribadi (riwayat, simpanan, preferensi) disimpan di browser pengguna: tanpa akun, tanpa beban server
const P = 'nimeku:';
export const read = (k, d) => { try { const v = localStorage.getItem(P + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
export const write = (k, v, silent = false) => {
  try { localStorage.setItem(P + k, JSON.stringify(v)); if (!silent) window.dispatchEvent(new Event('nimeku:store')); } catch {}
};
export const remove = (k, silent = false) => {
  try { localStorage.removeItem(P + k); if (!silent) window.dispatchEvent(new Event('nimeku:store')); } catch {}
};

// Hook: baca nilai tersimpan dan ikut berubah saat komponen lain menyimpan
export function useStored(key, fallback) {
  const [v, setV] = useState(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => { setV(read(key, fallback)); setReady(true); };
    load();
    window.addEventListener('nimeku:store', load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener('nimeku:store', load); window.removeEventListener('storage', load); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, ready];
}

// Tanda episode yang sudah ditonton (per anime, daftar nomor episode). Dipakai pemutar dan daftar episode.
export function markSeen(animeId, n) {
  const k = `seen:${animeId}`;
  const list = read(k, []);
  if (list.includes(n)) return;
  write(k, [...list, n].slice(-3000), true);
  touchDay(true);
}

// Aktivitas harian { 'YYYY-MM-DD': jumlah episode selesai }, dipakai kartu aktivitas di beranda (beruntun hari, grafik 7 hari)
export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let lastTouched = '';
export function touchDay(done = false) {
  const k = dayKey();
  if (!done && lastTouched === k) return;
  lastTouched = k;
  const days = read('days', {});
  if (days[k] === undefined) days[k] = 0;
  if (done) days[k] += 1;
  const keys = Object.keys(days).sort();
  while (keys.length > 120) delete days[keys.shift()];
  write('days', days, true);
}
