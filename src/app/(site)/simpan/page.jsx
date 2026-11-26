'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import AnimeCard from '@/components/AnimeCard';
import { read, useStored, write } from '@/lib/store';

const TABS = [
  { k: 'later', label: 'Tonton nanti', empty: 'Belum ada tontonan yang disimpan. Buka sebuah anime lalu ketuk Tonton nanti.' },
  { k: 'bookmark', label: 'Bookmark', empty: 'Belum ada bookmark. Buka sebuah anime lalu ketuk Bookmark untuk menandai favorit.' },
];

export default function SimpanPage() {
  const [tab, setTab] = useState('later');
  const [later] = useStored('later', []);
  const [marks, ready] = useStored('bookmark', []);
  const [latest, setLatest] = useState({});
  const lists = { later, bookmark: marks };

  // Cek jumlah episode terbaru untuk anime yang disimpan (maks. 12), supaya tahu mana yang punya episode belum ditonton
  const ids = [...new Set([...marks, ...later].map((x) => x.id))].slice(0, 12).join(',');
  useEffect(() => {
    if (!ids) return;
    const ctl = new AbortController();
    fetch(`/api/cek?ids=${encodeURIComponent(ids)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => setLatest(j.latest || {}))
      .catch(() => {});
    return () => ctl.abort();
  }, [ids]);
  const status = (id) => {
    const total = latest[id];
    if (!total) return '';
    const seenN = read(`seen:${id}`, []).length;
    if (!seenN) return `${total} episode`;
    const left = Math.max(0, total - seenN);
    return left > 0 ? `${left} episode belum ditonton` : 'Sudah ditonton semua';
  };
  const items = lists[tab];
  const drop = (id) => write(tab, items.filter((x) => x.id !== id));

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-28 space-y-5">
      <h1 className="font-display text-lg">Simpanan</h1>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)} aria-pressed={tab === t.k}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${tab === t.k ? 'bg-sakura text-ink' : 'bg-night text-mist ring-1 ring-edge'}`}>
            {t.label} ({lists[t.k].length})
          </button>
        ))}
      </div>
      {ready && items.length === 0 && (
        <div className="space-y-3 text-sm text-mist">
          <p>{TABS.find((t) => t.k === tab).empty}</p>
          <Link href="/jelajah" className="inline-block rounded-full bg-sakura text-ink px-4 py-2 text-sm font-bold">Jelajah anime</Link>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-5">
        {items.map((a) => (
          <div key={a.id} className="relative">
            <AnimeCard anime={a} />
            {status(a.id) && <p className="text-[11px] font-semibold text-lantern -mt-0.5">{status(a.id)}</p>}
            <button type="button" onClick={() => drop(a.id)} aria-label="Hapus dari simpanan" className="absolute top-2 right-2 size-7 rounded-full bg-ink/75 grid place-items-center active:scale-90">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
