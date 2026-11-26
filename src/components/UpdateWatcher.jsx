'use client';

import { useEffect } from 'react';
import { read } from '@/lib/store';
import { checkUpdates, showSystem } from '@/lib/notif';

// Tanpa tampilan. Memeriksa episode baru anime yang dipantau: saat situs dibuka, saat tab kembali terlihat,
// dan tiap beberapa menit selama terbuka (dibatasi 15 menit sekali di lib/notif).
export default function UpdateWatcher() {
  useEffect(() => {
    let dead = false;
    const run = async (force) => {
      const r = await checkUpdates({ force });
      if (!dead) r.fresh.forEach((n) => showSystem(n));
      window.dispatchEvent(new Event('nimeku:checked'));
    };
    if (read('notifbrowser', false) && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const t0 = setTimeout(() => run(false), 4000);
    const iv = setInterval(() => document.visibilityState === 'visible' && run(false), 5 * 60 * 1000);
    const onVis = () => document.visibilityState === 'visible' && run(false);
    const onForce = () => run(true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('nimeku:checkupdates', onForce);
    return () => {
      dead = true;
      clearTimeout(t0);
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('nimeku:checkupdates', onForce);
    };
  }, []);
  return null;
}
