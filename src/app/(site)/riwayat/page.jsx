'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import HistoryCard from '@/components/HistoryCard';
import { useStored, write } from '@/lib/store';

const DAY = 864e5;
// Kelompok menurut kapan terakhir ditonton
const bucket = (at) => {
  const startToday = new Date().setHours(0, 0, 0, 0);
  if (!at || at >= startToday) return 'Hari ini';
  if (at >= startToday - DAY) return 'Kemarin';
  if (at >= startToday - 6 * DAY) return '7 hari terakhir';
  return 'Lebih lama';
};
const ORDER = ['Hari ini', 'Kemarin', '7 hari terakhir', 'Lebih lama'];

export default function RiwayatPage() {
  const [hist, ready] = useStored('history', []);
  const [q, setQ] = useState('');
  const [sure, setSure] = useState(false);
  const drop = (id) => write('history', hist.filter((h) => h.animeId !== id));

  const term = q.trim().toLowerCase();
  const shown = hist.filter((h) => !term || String(h.title).toLowerCase().includes(term));
  const groups = ORDER.map((name) => [name, shown.filter((h) => bucket(h.at) === name)]).filter(([, l]) => l.length);
  const almost = hist.filter((h) => h.d && h.t / h.d >= 0.92).length;

  const wipe = () => {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; }
    write('history', []);
    setSure(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-28 space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-lg">Riwayat tonton</h1>
        {hist.length > 0 && <button type="button" onClick={wipe} className="text-xs font-semibold text-sakura">{sure ? 'Yakin? Ketuk lagi' : 'Hapus semua'}</button>}
      </div>

      {ready && hist.length === 0 && (
        <div className="space-y-3 text-sm text-mist">
          <p>Belum ada riwayat. Tonton satu episode dan posisinya tercatat di sini, jadi Anda bisa lanjut kapan saja.</p>
          <Link href="/jelajah" className="inline-block rounded-full bg-sakura text-ink px-4 py-2 text-sm font-bold">Cari tontonan</Link>
        </div>
      )}

      {hist.length > 0 && (
        <>
          <div className="flex items-center gap-3 text-xs text-mist">
            <span><b className="text-paper">{hist.length}</b> anime</span>
            {almost > 0 && <span><b className="text-lantern">{almost}</b> hampir selesai</span>}
          </div>
          {hist.length > 4 && (
            <label className="relative block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-mist" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari di riwayat" aria-label="Cari di riwayat"
                className="w-full rounded-xl bg-night border border-edge pl-10 pr-3 py-2.5 text-sm placeholder:text-mist/70 focus:border-sakura focus:outline-none" />
            </label>
          )}
        </>
      )}

      {term && shown.length === 0 && <p className="text-sm text-mist">Tidak ada riwayat yang cocok.</p>}

      {groups.map(([name, list]) => (
        <section key={name} className="space-y-2.5">
          <h2 className="flex items-center gap-3 text-[11px] font-bold tracking-[.18em] text-mist uppercase">
            {name}<span className="font-medium tracking-normal normal-case">{list.length}</span><span className="h-px flex-1 bg-edge" />
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((h) => <HistoryCard key={h.animeId} h={h} onRemove={() => drop(h.animeId)} />)}
          </div>
        </section>
      ))}

      {hist.length > 0 && <p className="text-xs text-mist">Riwayat tersimpan di browser ini saja. Cadangkan lewat Pengaturan.</p>}
    </div>
  );
}
