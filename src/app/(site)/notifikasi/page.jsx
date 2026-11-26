'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, RefreshCw, X } from 'lucide-react';
import { useStored, write, read } from '@/lib/store';
import { epText, followed } from '@/lib/notif';

const ago = (at) => {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} jam lalu`;
  const d = Math.floor(m / 1440);
  return d === 1 ? 'kemarin' : `${d} hari lalu`;
};

export default function NotifikasiPage() {
  const [list, ready] = useStored('notif', []);
  const [on] = useStored('notifon', true);
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState({ n: 0, at: 0 });

  useEffect(() => {
    const load = () => { setInfo({ n: followed().length, at: read('notifcheck', 0) }); setChecking(false); };
    load();
    window.addEventListener('nimeku:checked', load);
    return () => window.removeEventListener('nimeku:checked', load);
  }, []);

  const unread = list.filter((x) => !x.read).length;
  const markAll = () => write('notif', list.map((x) => ({ ...x, read: true })));
  const open = (id) => write('notif', list.map((x) => (x.id === id ? { ...x, read: true } : x)));
  const drop = (id) => write('notif', list.filter((x) => x.id !== id));
  const check = () => { setChecking(true); window.dispatchEvent(new Event('nimeku:checkupdates')); };
  const clock = info.at ? new Date(info.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-28 space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-lg">Update episode</h1>
        {unread > 0 && <button type="button" onClick={markAll} className="text-xs font-semibold text-sakura">Tandai semua dibaca</button>}
      </div>

      <div className="rounded-2xl bg-night ring-1 ring-edge p-4 space-y-3">
        <p className="text-xs text-mist leading-relaxed">
          {on
            ? `Memantau ${info.n} anime dari bookmark, tonton nanti, dan riwayatmu. Episode baru dicek saat Nimeku terbuka${clock ? `, terakhir pukul ${clock}` : ''}.`
            : 'Notifikasi update sedang mati.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {on && (
            <button type="button" onClick={check} disabled={checking} className="inline-flex items-center gap-2 rounded-xl bg-sakura text-ink px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform disabled:opacity-60">
              <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} /> {checking ? 'Memeriksa…' : 'Cek sekarang'}
            </button>
          )}
          <Link href="/pengaturan" className="inline-flex items-center rounded-xl bg-ink ring-1 ring-edge px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform">Atur notifikasi</Link>
        </div>
      </div>

      {ready && list.length === 0 && (
        <div className="py-10 text-center space-y-2 text-mist">
          <Bell className="size-8 mx-auto" />
          <p className="text-sm">Belum ada update.</p>
          <p className="text-xs max-w-xs mx-auto">Bookmark atau simpan anime yang kamu ikuti. Kalau ada episode baru, muncul di sini.</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {list.map((n) => (
          <li key={n.id} className="relative">
            <Link href={`/watch/${encodeURIComponent(n.epId)}`} onClick={() => open(n.id)}
              className={`flex gap-3 rounded-2xl p-3 pr-10 ring-1 active:bg-edge/40 ${n.read ? 'bg-night ring-edge' : 'bg-night ring-sakura/60'}`}>
              <div className="w-14 aspect-[3/4] rounded-lg overflow-hidden skeleton shrink-0">
                {n.poster && <img src={n.poster} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                <p className="text-sm font-bold leading-snug line-clamp-2">{n.title}</p>
                <p className="text-xs text-lantern font-semibold">{epText(n)}</p>
                <p className="text-xs text-mist">{ago(n.at)}</p>
              </div>
              {!n.read && <span className="absolute top-3 right-10 size-2 rounded-full bg-sakura" aria-label="Belum dibaca" />}
            </Link>
            <button type="button" onClick={() => drop(n.id)} aria-label="Hapus notifikasi" className="absolute top-2 right-2 size-7 rounded-full bg-ink/70 grid place-items-center active:scale-90">
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
