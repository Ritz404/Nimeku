'use client';

import { Flame } from 'lucide-react';
import { dayKey, useStored } from '@/lib/store';

const DAY = 864e5;

// Kartu aktivitas di Beranda: beruntun berapa hari menonton, total episode selesai, dan grafik 7 hari terakhir
export default function WatchStats() {
  const [days] = useStored('days', {});
  const keys = Object.keys(days);
  if (!keys.length) return null;

  const total = Object.values(days).reduce((a, b) => a + b, 0);
  const active = (t) => days[dayKey(t)] !== undefined;
  let streak = 0;
  let t = Date.now();
  if (!active(t)) t -= DAY; // belum menonton hari ini: hitung dari kemarin
  while (active(t)) { streak++; t -= DAY; }

  const week = Array.from({ length: 7 }, (_, i) => {
    const ts = Date.now() - (6 - i) * DAY;
    const k = dayKey(ts);
    return { k, n: days[k] || 0, on: days[k] !== undefined, label: new Date(ts).toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3) };
  });
  const max = Math.max(1, ...week.map((w) => w.n));

  return (
    <section className="rounded-2xl bg-night ring-1 ring-edge p-4 flex items-end justify-between gap-4 reveal" aria-label="Aktivitas tonton">
      <div className="space-y-3">
        <p className="text-[10px] font-bold tracking-[.18em] text-mist">AKTIVITAS TONTON</p>
        <div className="flex gap-5">
          <div>
            <p className="font-display text-2xl leading-none text-lantern flex items-center gap-1.5">{streak}<Flame className="size-5 text-sakura" /></p>
            <p className="text-[11px] text-mist mt-1">hari beruntun</p>
          </div>
          <div>
            <p className="font-display text-2xl leading-none">{total}</p>
            <p className="text-[11px] text-mist mt-1">episode selesai</p>
          </div>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-16" aria-hidden="true">
        {week.map((w) => (
          <div key={w.k} className="flex flex-col items-center gap-1">
            <div className={`w-3.5 rounded-t-md ${w.n > 0 ? 'bg-sakura' : w.on ? 'bg-mist/50' : 'bg-edge'}`} style={{ height: `${w.n > 0 ? 8 + (w.n / max) * 32 : 6}px` }} />
            <span className="text-[9px] text-mist capitalize">{w.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
