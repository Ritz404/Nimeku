'use client';

import { read, write } from '@/lib/store';

const MAX_FOLLOW = 20;
const EVERY = 10 * 60 * 1000; // jarak minimal antar pengecekan

// Anime yang dipantau: bookmark, tonton nanti, lalu riwayat (maksimal 20, yang paling dekat dengan minat didahulukan)
export function followed() {
  const seen = new Set();
  const out = [];
  const add = (x) => {
    const id = x?.id || x?.animeId;
    if (id && !seen.has(id) && out.length < MAX_FOLLOW) { seen.add(id); out.push({ id, title: x.title, poster: x.poster }); }
  };
  // Riwayat paling dulu: anime yang sedang diikuti paling mungkin punya episode baru
  read('history', []).slice(0, 10).forEach(add);
  read('bookmark', []).forEach(add);
  read('later', []).forEach(add);
  return out;
}

// Bandingkan episode terbaru dengan yang tercatat terakhir kali.
// - Sudah pernah tercatat: ada episode lebih besar -> notifikasi.
// - Baru pertama dipantau: bila pernah ditonton dalam 30 hari terakhir dan ada episode yang lebih baru dari yang ditonton,
//   beri tahu sekali; selain itu hanya mencatat patokan (supaya anime lama tidak membanjiri daftar).
export async function checkUpdates({ force = false } = {}) {
  if (!read('notifon', true)) return { fresh: [] };
  const now = Date.now();
  if (!force && now - read('notifcheck', 0) < EVERY) return { fresh: [] };
  const list = followed();
  if (!list.length) { write('notifcheck', now, true); return { fresh: [] }; }

  let items;
  try {
    const r = await fetch(`/api/update?ids=${list.map((x) => encodeURIComponent(x.id)).join(',')}`, { cache: 'no-store' });
    if (!r.ok) return { fresh: [], error: true };
    items = (await r.json()).items || [];
  } catch { return { fresh: [], error: true }; }

  const last = read('eplast', {});
  const hist = read('history', []);
  let notif = read('notif', []);
  const fresh = [];
  for (const it of items) {
    const prev = last[it.id];
    const watched = hist.find((h) => h.animeId === it.id);
    const seenN = watched ? Number(watched.n) || 0 : 0;
    let from = 0;
    if (prev === undefined) {
      if (watched && now - (watched.at || 0) < 30 * 864e5 && it.latest > seenN) from = seenN + 1;
    } else if (it.latest > prev) from = Math.max(prev + 1, seenN + 1);
    last[it.id] = Math.max(prev ?? 0, it.latest);
    if (!from || from > it.latest) continue;
    if (notif.some((x) => x.id === it.id && x.ep >= it.latest)) continue; // sudah pernah diberitahu
    const base = list.find((x) => x.id === it.id);
    const n = { id: it.id, title: it.title || base?.title || it.id, poster: it.poster || base?.poster || '', ep: it.latest, from, epId: it.latestId, at: now, read: false };
    notif = [n, ...notif.filter((x) => x.id !== it.id)];
    fresh.push(n);
  }
  write('eplast', last, true);
  write('notifcheck', now, true);
  write('notif', notif.slice(0, 60)); // memicu pembaruan lencana dan daftar
  return { fresh };
}

export const epText = (n) => (n.from && n.from < n.ep ? `Episode ${n.from} sampai ${n.ep} sudah rilis` : `Episode ${n.ep} sudah rilis`);

// Notifikasi sistem (di bilah notifikasi HP) bila diizinkan; hanya muncul saat Nimeku terbuka karena tidak memakai push server.
// Chrome di Android hanya mengizinkan notifikasi lewat service worker, jadi didaftarkan dulu bila belum ada.
async function swReg() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    return reg;
  } catch { return null; }
}
export async function showSystem(n, { force = false } = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  if (!force && !read('notifbrowser', false)) return false;
  const opts = { body: epText(n), icon: n.poster || '/icon.svg', tag: `nimeku-${n.id}`, data: { url: n.epId ? `/watch/${encodeURIComponent(n.epId)}` : '/notifikasi' } };
  const reg = await swReg();
  if (reg) { try { await reg.showNotification(n.title, opts); return true; } catch {} }
  try { new Notification(n.title, opts); return true; } catch { return false; }
}
