'use client';

import Link from 'next/link';
import HistoryCard from '@/components/HistoryCard';
import { useStored } from '@/lib/store';

// Baris "Lanjut menonton" di Beranda; tidak tampil sama sekali bila belum ada riwayat
export default function ContinueRow() {
  const [hist] = useStored('history', []);
  if (!hist.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg">Lanjut menonton <span className="ml-1 text-xs font-sans text-mist">続き</span></h2>
        <Link href="/riwayat" className="text-xs font-semibold text-sakura">Semua riwayat</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x">
        {hist.slice(0, 8).map((h) => <HistoryCard key={h.animeId} h={h} className="w-72 shrink-0 snap-start" />)}
      </div>
    </section>
  );
}
